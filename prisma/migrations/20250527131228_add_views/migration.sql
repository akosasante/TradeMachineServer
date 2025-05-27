create or replace view hydrated_picks
            (id, season, type, round, "pickNumber", "currentPickHolder", "originalPickOwner") as
SELECT draft_pick.id,
       draft_pick.season,
       draft_pick.type,
       draft_pick.round,
       draft_pick."pickNumber",
       (SELECT json_build_object('id', t.id, 'name', t.name) AS json_build_object
        FROM team t
        WHERE t.id = draft_pick."currentOwnerId")  AS "currentPickHolder",
       (SELECT json_build_object('id', t.id, 'name', t.name) AS json_build_object
        FROM team t
        WHERE t.id = draft_pick."originalOwnerId") AS "originalPickOwner"
FROM draft_pick;

create or replace view hydrated_majors
            (id, name, league, "mlbTeam", "ownerTeam", "eligiblePositions", "mainPosition") as
SELECT player.id,
       player.name,
       player.league,
       COALESCE(player."mlbTeam", (player.meta ->> 'proTeamId'::text)::character varying) AS "mlbTeam",
       (SELECT json_build_object('id', t.id, 'name', t.name) AS json_build_object
        FROM team t
        WHERE t.id = player."leagueTeamId")                                               AS "ownerTeam",
       ((player.meta -> 'espnPlayer'::text) -> 'player'::text) -> 'eligibleSlots'::text   AS "eligiblePositions",
       player.meta -> 'position'::text                                                    AS "mainPosition"
FROM player
WHERE player.league::text = '1'::text;

create or replace view hydrated_minors
            (id, name, league, "ownerTeam", "minorTeam", position, "minorLeagueLevel") as
SELECT player.id,
       player.name,
       player.league,
       (SELECT json_build_object('id', t.id, 'name', t.name) AS json_build_object
        FROM team t
        WHERE t.id = player."leagueTeamId")                                        AS "ownerTeam",
       (player.meta -> 'minorLeaguePlayerFromSheet'::text) ->> 'mlbTeam'::text     AS "minorTeam",
       (player.meta -> 'minorLeaguePlayerFromSheet'::text) ->> 'position'::text    AS "position",
       (player.meta -> 'minorLeaguePlayerFromSheet'::text) ->> 'leagueLevel'::text AS "minorLeagueLevel"
FROM player
WHERE player.league::text = '2'::text;

create or replace view hydrated_trades
            ("tradeId", "dateCreated", "tradeStatus", "tradeCreator", "tradeRecipients", "decliningUser",
             "declinedReason", "acceptingUsers", "acceptedOnDate", "tradedMajors", "tradedMinors", "tradedPicks")
as
WITH trade_creator AS (SELECT p."tradeId",
                              (SELECT tm.name
                               FROM team tm
                               WHERE tm.id = p."teamId") AS name
                       FROM trade_participant p
                       WHERE p."participantType" = '1'::trade_participant_participanttype_enum),
     trade_recipients AS (SELECT p."tradeId",
                                 (SELECT tm.name
                                  FROM team tm
                                  WHERE tm.id = p."teamId") AS name
                          FROM trade_participant p
                          WHERE p."participantType" = '2'::trade_participant_participanttype_enum),
     accepted_users AS (SELECT t_1.id,
                               json_array_elements_text(t_1."acceptedBy"::json) AS "acceptedById"
                        FROM trade t_1),
     players_with_participants AS (SELECT i."tradeId",
                                          (SELECT tm.name
                                           FROM team tm
                                           WHERE tm.id = i."senderId")    AS sender,
                                          (SELECT tm.name
                                           FROM team tm
                                           WHERE tm.id = i."recipientId") AS recipient,
                                          p.id,
                                          p.name,
                                          p.league,
                                          p."mlbTeam",
                                          p."ownerTeam",
                                          p."eligiblePositions",
                                          p."mainPosition"
                                   FROM trade_item i
                                            RIGHT JOIN hydrated_majors p ON p.id = i."tradeItemId"
                                   WHERE i."tradeItemType" = '1'::trade_item_tradeitemtype_enum),
     traded_players AS (SELECT i."tradeId",
                               array_to_json(array_agg(row_to_json(p.*))) AS "tradedMajors"
                        FROM trade_item i
                                 RIGHT JOIN players_with_participants p ON p."tradeId" = i."tradeId"
                        WHERE i."tradeItemType" = '1'::trade_item_tradeitemtype_enum
                          AND i."tradeItemId" = p.id
                        GROUP BY i."tradeId"),
     prospects_with_participants AS (SELECT i."tradeId",
                                            (SELECT tm.name
                                             FROM team tm
                                             WHERE tm.id = i."senderId")    AS sender,
                                            (SELECT tm.name
                                             FROM team tm
                                             WHERE tm.id = i."recipientId") AS recipient,
                                            p.id,
                                            p.name,
                                            p.league,
                                            p."ownerTeam",
                                            p."minorTeam",
                                            p."position",
                                            p."minorLeagueLevel"
                                     FROM trade_item i
                                              RIGHT JOIN hydrated_minors p ON p.id = i."tradeItemId"
                                     WHERE i."tradeItemType" = '1'::trade_item_tradeitemtype_enum),
     traded_minors AS (SELECT i."tradeId",
                              array_to_json(array_agg(row_to_json(p.*)))::jsonb AS "tradedMinors"
                       FROM trade_item i
                                RIGHT JOIN prospects_with_participants p ON p."tradeId" = i."tradeId"
                       WHERE i."tradeItemType" = '1'::trade_item_tradeitemtype_enum
                         AND i."tradeItemId" = p.id
                       GROUP BY i."tradeId"),
     picks_with_participants AS (SELECT i."tradeId",
                                        (SELECT tm.name
                                         FROM team tm
                                         WHERE tm.id = i."senderId")    AS sender,
                                        (SELECT tm.name
                                         FROM team tm
                                         WHERE tm.id = i."recipientId") AS recipient,
                                        d.id,
                                        d.season,
                                        d.type,
                                        d.round,
                                        d."pickNumber",
                                        d."currentPickHolder",
                                        d."originalPickOwner"
                                 FROM trade_item i
                                          RIGHT JOIN hydrated_picks d ON d.id = i."tradeItemId"
                                 WHERE i."tradeItemType" = '2'::trade_item_tradeitemtype_enum),
     traded_picks AS (SELECT i."tradeId",
                             array_to_json(array_agg(row_to_json(d.*))) AS "tradedPicks"
                      FROM trade_item i
                               RIGHT JOIN picks_with_participants d ON d."tradeId" = i."tradeId"
                      WHERE i."tradeItemType" = '2'::trade_item_tradeitemtype_enum
                        AND i."tradeItemId" = d.id
                      GROUP BY i."tradeId")
SELECT t.id                                               AS "tradeId",
       t."dateCreated",
       t.status                                           AS "tradeStatus",
       (SELECT tc.name
        FROM trade_creator tc
        WHERE tc."tradeId" = t.id)                        AS "tradeCreator",
       (SELECT array_agg(tr.name) AS array_agg
        FROM trade_recipients tr
        WHERE tr."tradeId" = t.id)                        AS "tradeRecipients",
       (SELECT u."displayName"
        FROM "user" u
        WHERE u.id = t."declinedById")                    AS "decliningUser",
       t."declinedReason",
       (SELECT array_agg(u."displayName") AS array_agg
        FROM "user" u
                 LEFT JOIN accepted_users ON t.id = accepted_users.id
        WHERE u.id = accepted_users."acceptedById"::uuid) AS "acceptingUsers",
       t."acceptedOnDate",
       (SELECT tp."tradedMajors"
        FROM traded_players tp
        WHERE tp."tradeId" = t.id)                        AS "tradedMajors",
       (SELECT tp."tradedMinors"
        FROM traded_minors tp
        WHERE tp."tradeId" = t.id)                        AS "tradedMinors",
       (SELECT tp."tradedPicks"
        FROM traded_picks tp
        WHERE tp."tradeId" = t.id)                        AS "tradedPicks"
FROM trade t;

