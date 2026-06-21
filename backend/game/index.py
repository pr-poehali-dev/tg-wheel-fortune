import json
import os
import psycopg2
import psycopg2.extras


def _resp(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
        },
        'isBase64Encoded': False,
        'body': json.dumps(body),
    }


def _conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def _esc(v):
    return str(v).replace("'", "''")


def handler(event: dict, context) -> dict:
    '''Игровой бэкенд: прогресс игрока, таблица лидеров и реферальная система.

    Действия (поле action в теле или query):
      - get_progress: вернуть прогресс игрока по id
      - upsert_progress: сохранить баланс, уровень и статистику
      - leaderboard: топ игроков
      - referral_register: зарегистрировать приглашённого друга
      - referrals_my: список друзей игрока
    '''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return _resp(200, {'ok': True})

    params = event.get('queryStringParameters') or {}
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            body = {}

    action = body.get('action') or params.get('action') or ''

    conn = _conn()
    conn.autocommit = True
    try:
        if action == 'get_progress':
            uid = int(body.get('id') or params.get('id') or 0)
            if not uid:
                return _resp(400, {'ok': False, 'error': 'no id'})
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, name, photo, balance_w, balance_b, game_level, "
                    "claimed_level, onboarding_done, level_stats "
                    f"FROM players WHERE id = {uid}"
                )
                row = cur.fetchone()
            if not row:
                return _resp(200, {'ok': True, 'found': False})
            return _resp(200, {
                'ok': True,
                'found': True,
                'balance_w': int(row['balance_w']),
                'balance_b': int(row['balance_b']),
                'game_level': int(row['game_level']),
                'claimed_level': int(row['claimed_level']),
                'onboarding_done': bool(row['onboarding_done']),
                'level_stats': row['level_stats'] or {},
            })

        if action == 'upsert_progress':
            uid = int(body.get('id') or 0)
            if not uid:
                return _resp(400, {'ok': False, 'error': 'no id'})
            name = _esc(body.get('name') or '')
            photo = body.get('photo')
            photo_sql = "NULL" if not photo else f"'{_esc(photo)}'"
            bw = int(body.get('balance_w') if body.get('balance_w') is not None else 10000)
            bb = int(body.get('balance_b') or 0)
            lvl = int(body.get('game_level') or 0)
            clvl = int(body.get('claimed_level') or 0)
            onb = bool(body.get('onboarding_done'))
            stats = _esc(json.dumps(body.get('level_stats') or {}))
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO players (id, name, photo, balance_w, balance_b, game_level, "
                    "claimed_level, onboarding_done, level_stats, updated_at) "
                    f"VALUES ({uid}, '{name}', {photo_sql}, {bw}, {bb}, {lvl}, {clvl}, "
                    f"{'TRUE' if onb else 'FALSE'}, '{stats}'::jsonb, now()) "
                    "ON CONFLICT (id) DO UPDATE SET "
                    "name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE players.name END, "
                    "photo = COALESCE(EXCLUDED.photo, players.photo), "
                    "balance_w = EXCLUDED.balance_w, "
                    "balance_b = EXCLUDED.balance_b, "
                    "game_level = GREATEST(players.game_level, EXCLUDED.game_level), "
                    "claimed_level = GREATEST(players.claimed_level, EXCLUDED.claimed_level), "
                    "onboarding_done = players.onboarding_done OR EXCLUDED.onboarding_done, "
                    "level_stats = EXCLUDED.level_stats, "
                    "updated_at = now()"
                )
            return _resp(200, {'ok': True})

        if action == 'leaderboard':
            limit = int(params.get('limit') or body.get('limit') or 100)
            limit = max(1, min(200, limit))
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, name, photo, game_level, "
                    "(balance_w + balance_b * 10000) AS total_coins "
                    "FROM players ORDER BY total_coins DESC, updated_at ASC "
                    f"LIMIT {limit}"
                )
                rows = cur.fetchall()
            items = [{
                'id': int(r['id']),
                'name': r['name'] or 'Игрок',
                'photo': r['photo'],
                'level': int(r['game_level']),
                'coins': int(r['total_coins']),
            } for r in rows]
            return _resp(200, {'ok': True, 'items': items})

        if action == 'referral_register':
            inviter_id = int(body.get('inviter_id') or 0)
            friend_id = int(body.get('friend_id') or 0)
            if not inviter_id or not friend_id or inviter_id == friend_id:
                return _resp(400, {'ok': False, 'error': 'bad ids'})
            name = _esc(body.get('name') or 'Player')
            photo = body.get('photo')
            photo_sql = "NULL" if not photo else f"'{_esc(photo)}'"
            reward_w = 5000
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO referrals (inviter_id, friend_id, name, photo, reward_w) "
                    f"VALUES ({inviter_id}, {friend_id}, '{name}', {photo_sql}, {reward_w}) "
                    "ON CONFLICT (inviter_id, friend_id) DO NOTHING RETURNING id"
                )
                inserted = cur.fetchone()
            should_reward = inserted is not None
            if should_reward:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE players SET balance_w = balance_w + 5000, updated_at = now() "
                        f"WHERE id = {inviter_id}"
                    )
            return _resp(200, {
                'ok': True,
                'shouldReward': should_reward,
                'rewardW': reward_w if should_reward else 0,
            })

        if action == 'referrals_my':
            uid = int(body.get('id') or params.get('id') or 0)
            if not uid:
                return _resp(400, {'ok': False, 'error': 'no id'})
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT r.friend_id, r.name, r.photo, r.reward_w, "
                    "p.game_level, (p.balance_w + p.balance_b * 10000) AS coins "
                    "FROM referrals r LEFT JOIN players p ON p.id = r.friend_id "
                    f"WHERE r.inviter_id = {uid} ORDER BY r.created_at DESC"
                )
                rows = cur.fetchall()
            items = [{
                'id': int(r['friend_id']),
                'name': r['name'] or 'Игрок',
                'photo': r['photo'],
                'rewardW': int(r['reward_w']),
                'level': int(r['game_level'] or 1),
                'coins': int(r['coins'] or 0),
            } for r in rows]
            return _resp(200, {'ok': True, 'items': items})

        return _resp(400, {'ok': False, 'error': 'unknown action'})
    finally:
        conn.close()
