import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { Button, EmptyState, ErrorNotice, Field, Header, Screen } from "@/components/ui";
import { createProject, deleteProject, listProjects, updateProject } from "@/data/repositories";
import { deleteStoredCover, importNovelFromDevice, pickCoverImage } from "@/lib/novel-import";
import type { RootStackParamList, RootTabParamList } from "@/navigation/types";
import { useAppStore } from "@/store/app-store";
import { colors, radius, spacing } from "@/theme";
import type { Project } from "@/types";

export function ProjectsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionProject, setActionProject] = useState<Project | null>(null);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [summaryTarget, setSummaryTarget] = useState<Project | null>(null);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [managing, setManaging] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMode, setEditMode] = useState<"title" | "summary" | null>(null);
  const [showAddAction, setShowAddAction] = useState(false);
  const [importing, setImporting] = useState(false);
  const [coverSaving, setCoverSaving] = useState(false);
  const setCurrentProject = useAppStore((state) => state.setCurrentProject);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await listProjects());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadProjects();
  }, [loadProjects]));

  const openProject = (project: Project) => {
    setCurrentProject(project.id);
    navigation.navigate("Writing");
  };

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const project = await createProject(title, description);
      setTitle("");
      setDescription("");
      setShowCreate(false);
      setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
      openProject(project);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSaving(false);
    }
  };

  const saveProjectEdit = async () => {
    if (!renameTarget) return;
    const nextTitle = renameTitle.trim();
    if (!nextTitle) {
      setError("作品名不能为空");
      return;
    }
    setSavingEdit(true);
    setError(null);
    try {
      const updated = await updateProject(renameTarget.id, {
        title: nextTitle,
        description: summaryDraft.trim(),
      });
      setProjects((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setRenameTarget(null);
      setSummaryTarget(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSavingEdit(false);
    }
  };

  const importNovel = async () => {
    setImporting(true);
    setError(null);
    try {
      const result = await importNovelFromDevice();
      if (result) {
        setProjects(await listProjects());
        Alert.alert("导入完成", `已导入《${result.title}》，共 ${result.chapterCount} 章。`);
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setImporting(false);
    }
  };
  const changeCover = async (project: Project) => {
    setCoverSaving(true);
    setError(null);
    try {
      const nextCover = await pickCoverImage(project.id, project.coverImagePath);
      if (!nextCover) return;
      const updated = await updateProject(project.id, { coverImagePath: nextCover });
      setProjects((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (coverError) {
      setError(coverError instanceof Error ? coverError.message : String(coverError));
    } finally {
      setCoverSaving(false);
    }
  };
  const clearCover = async (project: Project) => {
    setCoverSaving(true);
    setError(null);
    try {
      const updated = await updateProject(project.id, { coverImagePath: "" });
      setProjects((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      deleteStoredCover(project.coverImagePath);
    } catch (coverError) {
      setError(coverError instanceof Error ? coverError.message : String(coverError));
    } finally {
      setCoverSaving(false);
    }
  };
  const moveProject = (project: Project, offset: number) => {
    setProjects((current) => {
      const index = current.findIndex((item) => item.id === project.id);
      const targetIndex = index + offset;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      next[index] = current[targetIndex];
      next[targetIndex] = current[index];
      return next;
    });
  };

  const mergeProjects = (from: Project, to: Project) => {
    if (from.id === to.id) return;
    const keepIds = new Set([from.id]);
    Alert.alert(
      "整理作品",
      `把《${from.title}》合并进《${to.title}》？合并后《${from.title}》会被删除，其章节、角色、世界书与笔记不会自动迁移，请先确认。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "合并删除",
          style: "destructive",
          onPress: () => {
            void deleteProject(from.id)
              .then(() => {
                setProjects((current) => current.filter((item) => !keepIds.has(item.id)));
                if (currentProjectId === from.id) setCurrentProject(null);
              })
              .catch((deleteError) => setError(deleteError instanceof Error ? deleteError.message : String(deleteError)));
          },
        },
      ],
    );
  };

  const organizeProject = (project: Project, mode: "up" | "down" | "merge") => {
    const index = projects.findIndex((item) => item.id === project.id);
    if (mode === "up") {
      moveProject(project, -1);
      return;
    }
    if (mode === "down") {
      moveProject(project, 1);
      return;
    }
    const target = projects[index + 1] ?? projects[index - 1];
    if (!target) {
      setError("至少需要两部作品才能合并");
      return;
    }
    mergeProjects(project, target);
  };

  const confirmDelete = (project: Project) => {
    Alert.alert("删除作品", `确定删除《${project.title}》及全部本地数据？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          void deleteProject(project.id)
            .then(() => {
              setProjects((current) => current.filter((item) => item.id !== project.id));
              if (currentProjectId === project.id) setCurrentProject(null);
            })
            .catch((deleteError) => setError(deleteError instanceof Error ? deleteError.message : String(deleteError)));
        },
      },
    ]);
  };

  return (
    <Screen>
      <Header
        title="OpenFicM"
        action={
          <View style={styles.headerActions}>
            <Pressable accessibilityLabel="整理作品顺序" onPress={() => setManaging((current) => !current)} style={styles.iconButton}>
              <Ionicons name="swap-vertical" size={22} color={managing ? colors.primary : colors.textMuted} />
            </Pressable>
            <Pressable
              accessibilityLabel="新建或导入作品"
              disabled={importing}
              onPress={() => setShowAddAction(true)}
              style={styles.iconButton}
            >
              {importing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="add" size={26} color={colors.primary} />
              )}
            </Pressable>
          </View>
        }
      />
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={projects.length ? styles.list : styles.emptyList}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View>
            <View style={styles.quickActions}>
              <Pressable
                disabled={!currentProjectId}
                onPress={() => rootNavigation.navigate("Characters")}
                style={[styles.quickAction, !currentProjectId && styles.quickActionDisabled]}
              >
                <Ionicons name="people-outline" size={22} color={currentProjectId ? colors.primary : colors.textMuted} />
                <Text style={styles.quickActionText}>角色</Text>
              </Pressable>
              <Pressable
                disabled={!currentProjectId}
                onPress={() => rootNavigation.navigate("WorldInfo")}
                style={[styles.quickAction, !currentProjectId && styles.quickActionDisabled]}
              >
                <Ionicons name="globe-outline" size={22} color={currentProjectId ? colors.primary : colors.textMuted} />
                <Text style={styles.quickActionText}>世界书</Text>
              </Pressable>
              <Pressable
                disabled={!currentProjectId}
                onPress={() => rootNavigation.navigate("Notes")}
                style={[styles.quickAction, !currentProjectId && styles.quickActionDisabled]}
              >
                <Ionicons name="reader-outline" size={22} color={currentProjectId ? colors.primary : colors.textMuted} />
                <Text style={styles.quickActionText}>笔记</Text>
              </Pressable>
              <Pressable
                onPress={() => rootNavigation.navigate("StyleLibrary")}
                style={styles.quickAction}
              >
                <Ionicons name="color-wand-outline" size={22} color={colors.primary} />
                <Text style={styles.quickActionText}>文风库</Text>
              </Pressable>
            </View>
            {error ? <View style={styles.errorWrap}><ErrorNotice message={error} onRetry={() => void loadProjects()} /></View> : null}
          </View>
        }
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} /> : <EmptyState title="还没有作品" action={<Button label="新建作品" onPress={() => setShowCreate(true)} />} />}
        renderItem={({ item }) => (
          <View>
            {managing ? (
              <View style={styles.manageBar}>
                <Text style={styles.manageLabel} numberOfLines={1}>{item.title}</Text>
                <View style={styles.manageActions}>
                  <Pressable accessibilityLabel={`上移 ${item.title}`} onPress={() => organizeProject(item, "up")} style={styles.iconButton}>
                    <Ionicons name="arrow-up" size={20} color={colors.primary} />
                  </Pressable>
                  <Pressable accessibilityLabel={`下移 ${item.title}`} onPress={() => organizeProject(item, "down")} style={styles.iconButton}>
                    <Ionicons name="arrow-down" size={20} color={colors.primary} />
                  </Pressable>
                  <Pressable accessibilityLabel={`合并 ${item.title}`} onPress={() => organizeProject(item, "merge")} style={styles.iconButton}>
                    <Ionicons name="git-merge-outline" size={20} color={colors.primary} />
                  </Pressable>
                  <Pressable accessibilityLabel={`重命名 ${item.title}`} onPress={() => { setRenameTarget(item); setRenameTitle(item.title); setSummaryDraft(item.description); }} style={styles.iconButton}>
                    <Ionicons name="create-outline" size={20} color={colors.primary} />
                  </Pressable>
                  <Pressable accessibilityLabel={`删除 ${item.title}`} onPress={() => confirmDelete(item)} style={styles.iconButton}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            ) : null}
            <Pressable onPress={() => openProject(item)} onLongPress={() => setActionProject(item)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              {item.coverImagePath ? (
                <Image source={{ uri: item.coverImagePath }} style={styles.cover} resizeMode="cover" />
              ) : (
                <View style={styles.cover}><Text style={styles.coverText}>{item.title.slice(0, 1)}</Text></View>
              )}
              <View style={styles.rowText}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.description} numberOfLines={2}>{item.description || "暂无简介"}</Text>
              </View>
              <Pressable
                accessibilityLabel={`${item.title} 更多操作`}
                onPress={(event) => { event.stopPropagation(); setActionProject(item); }}
                hitSlop={8}
                style={styles.rowAction}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          </View>
        )}
      />

      <Modal visible={actionProject !== null} transparent animationType="fade" onRequestClose={() => setActionProject(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setActionProject(null)}>
          <Pressable style={styles.modalBody} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle} numberOfLines={1}>{actionProject?.title ?? ""}</Text>
            <View>
              <Pressable
                accessibilityLabel="修改作品名称"
                onPress={() => {
                  const target = actionProject;
                  setActionProject(null);
                  if (!target) return;
                  setRenameTarget(target);
                  setRenameTitle(target.title);
                  setSummaryDraft(target.description);
                  setEditMode("title");
                }}
                style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
              >
                <Ionicons name="create-outline" size={20} color={colors.text} />
                <Text style={styles.actionText}>修改作品名称</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="修改简介"
                onPress={() => {
                  const target = actionProject;
                  setActionProject(null);
                  if (!target) return;
                  setRenameTarget(target);
                  setRenameTitle(target.title);
                  setSummaryDraft(target.description);
                  setEditMode("summary");
                }}
                style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
              >
                <Ionicons name="document-text-outline" size={20} color={colors.text} />
                <Text style={styles.actionText}>修改简介</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="修改封面"
                disabled={coverSaving}
                onPress={() => {
                  const target = actionProject;
                  setActionProject(null);
                  if (target) void changeCover(target);
                }}
                style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
              >
                <Ionicons name="image-outline" size={20} color={colors.text} />
                <Text style={styles.actionText}>{coverSaving ? "正在处理封面…" : "修改封面"}</Text>
              </Pressable>
              {actionProject?.coverImagePath ? (
                <Pressable
                  accessibilityLabel="移除封面"
                  disabled={coverSaving}
                  onPress={() => {
                    const target = actionProject;
                    setActionProject(null);
                    if (target) void clearCover(target);
                  }}
                  style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                >
                  <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                  <Text style={[styles.actionText, styles.actionTextDanger]}>移除封面</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityLabel="删除作品"
                onPress={() => {
                  const target = actionProject;
                  setActionProject(null);
                  if (target) confirmDelete(target);
                }}
                style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <Text style={[styles.actionText, styles.actionTextDanger]}>删除作品</Text>
              </Pressable>
            </View>
            <View style={styles.modalActions}>
              <Button label="取消" variant="secondary" onPress={() => setActionProject(null)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={showAddAction} transparent animationType="fade" onRequestClose={() => setShowAddAction(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAddAction(false)}>
          <Pressable style={styles.modalBody} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>添加作品</Text>
            <View>
              <Pressable
                accessibilityLabel="新建作品"
                onPress={() => {
                  setShowAddAction(false);
                  setShowCreate(true);
                }}
                style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
              >
                <Ionicons name="create-outline" size={20} color={colors.text} />
                <Text style={styles.actionText}>新建作品</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="从本地导入"
                onPress={() => {
                  setShowAddAction(false);
                  void importNovel();
                }}
                style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
              >
                <Ionicons name="download-outline" size={20} color={colors.text} />
                <Text style={styles.actionText}>从本地导入（TXT / MD / EPUB）</Text>
              </Pressable>
            </View>
            <View style={styles.modalActions}>
              <Button label="取消" variant="secondary" onPress={() => setShowAddAction(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={editMode !== null} transparent animationType="fade" onRequestClose={() => setEditMode(null)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior="height" automaticOffset>
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>{editMode === "summary" ? "修改简介" : "修改作品名称"}</Text>
            {editMode === "summary" ? (
              <Field label="简介" value={summaryDraft} onChangeText={setSummaryDraft} multiline autoFocus />
            ) : (
              <Field label="书名" value={renameTitle} onChangeText={setRenameTitle} autoFocus />
            )}
            <View style={styles.modalActions}>
              <Button label="取消" variant="secondary" onPress={() => setEditMode(null)} />
              <Button
                label="保存"
                onPress={() => void saveProjectEdit().then(() => setEditMode(null))}
                disabled={editMode === "title" && !renameTitle.trim()}
                loading={savingEdit}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior="height" automaticOffset>
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>新建作品</Text>
            <Field label="书名" value={title} onChangeText={setTitle} autoFocus />
            <Field label="简介" value={description} onChangeText={setDescription} multiline />
            <View style={styles.modalActions}>
              <Button label="取消" variant="secondary" onPress={() => setShowCreate(false)} />
              <Button label="创建" onPress={() => void submit()} disabled={!title.trim()} loading={saving} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerActions: { flexDirection: "row", alignItems: "center" },
  manageBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surfaceMuted },
  manageLabel: { flex: 1, color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  manageActions: { flexDirection: "row", alignItems: "center" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  actionRowPressed: { backgroundColor: colors.surfaceMuted },
  actionText: { color: colors.text, fontSize: 16, fontWeight: "600" },
  actionTextDanger: { color: colors.danger },
  quickActions: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  quickAction: { flex: 1, minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  quickActionDisabled: { opacity: 0.48 },
  quickActionText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  errorWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  list: { paddingVertical: spacing.sm },
  emptyList: { flexGrow: 1 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 88 },
  row: { minHeight: 92, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  cover: { width: 56, height: 68, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  coverText: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  rowText: { flex: 1, gap: spacing.xs },
  rowAction: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: colors.overlay },
  modalBody: { gap: spacing.lg, padding: spacing.xl, borderRadius: radius.md, backgroundColor: colors.background },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
});
