-- ============================================
-- RLS有効化 & ポリシー設定（cf_テーブル全体）
-- Supabase SQL Editorで実行してください
-- ============================================

-- ========== 1. 全テーブルでRLS有効化 ==========
ALTER TABLE cf_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cf_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cf_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cf_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cf_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cf_game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cf_session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cf_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE cf_game_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cf_tonight_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE cf_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ========== 2. cf_groups ==========
CREATE POLICY "グループメンバーが閲覧可" ON cf_groups
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM cf_group_members WHERE group_id = cf_groups.id
    )
  );

CREATE POLICY "認証ユーザーが作成可" ON cf_groups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "招待コードで閲覧可" ON cf_groups
  FOR SELECT USING (true);
-- ※招待コードの検証はアプリ側で行う。SELECTは同名ポリシーが競合するため統合

-- 統合版に変更: メンバーまたは招待リンク経由
DROP POLICY IF EXISTS "グループメンバーが閲覧可" ON cf_groups;
DROP POLICY IF EXISTS "招待コードで閲覧可" ON cf_groups;

CREATE POLICY "認証ユーザーが閲覧可" ON cf_groups
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ========== 3. cf_group_members ==========
CREATE POLICY "メンバー同士が閲覧可" ON cf_group_members
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM cf_group_members gm WHERE gm.group_id = cf_group_members.group_id
    )
  );

CREATE POLICY "認証ユーザーが参加可" ON cf_group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "自分のメンバーシップを削除可" ON cf_group_members
  FOR DELETE USING (auth.uid() = user_id);

-- ========== 4. cf_posts ==========
CREATE POLICY "グループメンバーが閲覧可" ON cf_posts
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM cf_group_members WHERE group_id = cf_posts.group_id
    )
  );

CREATE POLICY "グループメンバーが投稿可" ON cf_posts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() IN (
      SELECT user_id FROM cf_group_members WHERE group_id = cf_posts.group_id
    )
  );

CREATE POLICY "自分の投稿を削除可" ON cf_posts
  FOR DELETE USING (auth.uid() = user_id);

-- ========== 5. cf_reactions ==========
CREATE POLICY "グループメンバーが閲覧可" ON cf_reactions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM cf_group_members gm
      JOIN cf_posts p ON p.group_id = gm.group_id
      WHERE p.id = cf_reactions.post_id
    )
  );

CREATE POLICY "グループメンバーがリアクション可" ON cf_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "自分のリアクションを削除可" ON cf_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- ========== 6. cf_comments ==========
CREATE POLICY "グループメンバーが閲覧可" ON cf_comments
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM cf_group_members gm
      JOIN cf_posts p ON p.group_id = gm.group_id
      WHERE p.id = cf_comments.post_id
    )
  );

CREATE POLICY "グループメンバーがコメント可" ON cf_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "自分のコメントを削除可" ON cf_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ========== 7. cf_game_sessions ==========
CREATE POLICY "グループメンバーが閲覧可" ON cf_game_sessions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM cf_group_members WHERE group_id = cf_game_sessions.group_id
    )
  );

CREATE POLICY "グループメンバーが作成可" ON cf_game_sessions
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND auth.uid() IN (
      SELECT user_id FROM cf_group_members WHERE group_id = cf_game_sessions.group_id
    )
  );

CREATE POLICY "作成者が更新可" ON cf_game_sessions
  FOR UPDATE USING (auth.uid() = created_by);

-- ========== 8. cf_session_participants ==========
CREATE POLICY "グループメンバーが閲覧可" ON cf_session_participants
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM cf_group_members gm
      JOIN cf_game_sessions gs ON gs.group_id = gm.group_id
      WHERE gs.id = cf_session_participants.session_id
    )
  );

CREATE POLICY "自分の参加を管理可" ON cf_session_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "自分の参加を更新可" ON cf_session_participants
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "自分の参加を削除可" ON cf_session_participants
  FOR DELETE USING (auth.uid() = user_id);

-- ========== 9. cf_availability ==========
CREATE POLICY "グループメンバーが閲覧可" ON cf_availability
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM cf_group_members WHERE group_id = cf_availability.group_id
    )
  );

CREATE POLICY "自分の予定を管理可" ON cf_availability
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "自分の予定を更新可" ON cf_availability
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "自分の予定を削除可" ON cf_availability
  FOR DELETE USING (auth.uid() = user_id);

-- ========== 10. cf_game_scores ==========
CREATE POLICY "グループメンバーが閲覧可" ON cf_game_scores
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM cf_group_members WHERE group_id = cf_game_scores.group_id
    )
  );

CREATE POLICY "自分のスコアを登録可" ON cf_game_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ========== 11. cf_tonight_status ==========
CREATE POLICY "グループメンバーが閲覧可" ON cf_tonight_status
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM cf_group_members WHERE group_id = cf_tonight_status.group_id
    )
  );

CREATE POLICY "自分のステータスを管理可" ON cf_tonight_status
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "自分のステータスを更新可" ON cf_tonight_status
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "自分のステータスを削除可" ON cf_tonight_status
  FOR DELETE USING (auth.uid() = user_id);

-- ========== 12. cf_push_subscriptions ==========
CREATE POLICY "自分のサブスクリプションを閲覧可" ON cf_push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "自分のサブスクリプションを登録可" ON cf_push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "自分のサブスクリプションを更新可" ON cf_push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "自分のサブスクリプションを削除可" ON cf_push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);
