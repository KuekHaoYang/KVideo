'use client';

import { AddSourceModal } from '@/components/settings/AddSourceModal';
import { ExportModal } from '@/components/settings/ExportModal';
import { ImportModal } from '@/components/settings/ImportModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SourceSettings } from '@/components/settings/SourceSettings';
import { SortSettings } from '@/components/settings/SortSettings';
import { DataSettings } from '@/components/settings/DataSettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { DisplaySettings } from '@/components/settings/DisplaySettings';
import { PlayerSettings } from '@/components/settings/PlayerSettings';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { UserSourceSettings } from '@/components/settings/UserSourceSettings';
import { UserDanmakuSettings } from '@/components/settings/UserDanmakuSettings';
import { PermissionGate } from '@/components/PermissionGate';
import { hasPermission } from '@/lib/store/auth-store';
import { useSettingsPage } from './hooks/useSettingsPage';

export default function SettingsPage() {
  const {
    sources,
    sortBy,
    realtimeLatency,
    searchDisplayMode,
    fullscreenType,
    isAddModalOpen,
    isExportModalOpen,
    isImportModalOpen,
    isResetDialogOpen,
    isRestoreDefaultsDialogOpen,
    setIsAddModalOpen,
    setIsExportModalOpen,
    setIsImportModalOpen,
    setIsResetDialogOpen,
    setIsRestoreDefaultsDialogOpen,
    handleSourcesChange,
    handleAddSource,
    handleSortChange,
    handleExport,
    handleImportFile,
    handleImportLink,
    subscriptions,
    handleAddSubscription,
    handleRemoveSubscription,
    handleRefreshSubscription,
    handleRestoreDefaults,
    handleResetAll,
    editingSource,
    handleEditSource,
    setEditingSource,
    handleRealtimeLatencyChange,
    handleSearchDisplayModeChange,
    handleFullscreenTypeChange,
    proxyMode,
    handleProxyModeChange,
    rememberScrollPosition,
    handleRememberScrollPositionChange,
    locale,
    handleLocaleChange,
    danmakuApiUrl,
    handleDanmakuApiUrlChange,
    danmakuOpacity,
    handleDanmakuOpacityChange,
    danmakuFontSize,
    handleDanmakuFontSizeChange,
    danmakuDisplayArea,
    handleDanmakuDisplayAreaChange,
  } = useSettingsPage();

  return (
    <div className="min-h-screen bg-[var(--bg-color)] bg-[image:var(--bg-image)] bg-fixed">
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        {/* Header */}
        <SettingsHeader />

        {/* Account Settings */}
        <AccountSettings />

        {/* Player Settings */}
        <PermissionGate permission="player_settings">
          <PlayerSettings
            fullscreenType={fullscreenType}
            onFullscreenTypeChange={handleFullscreenTypeChange}
            proxyMode={proxyMode}
            onProxyModeChange={handleProxyModeChange}
            danmakuApiUrl={danmakuApiUrl}
            onDanmakuApiUrlChange={handleDanmakuApiUrlChange}
            danmakuOpacity={danmakuOpacity}
            onDanmakuOpacityChange={handleDanmakuOpacityChange}
            danmakuFontSize={danmakuFontSize}
            onDanmakuFontSizeChange={handleDanmakuFontSizeChange}
            danmakuDisplayArea={danmakuDisplayArea}
            onDanmakuDisplayAreaChange={handleDanmakuDisplayAreaChange}
            showDanmakuApi={hasPermission('danmaku_api')}
          />
        </PermissionGate>

        {/* Display Settings */}
        <DisplaySettings
          realtimeLatency={realtimeLatency}
          searchDisplayMode={searchDisplayMode}
          rememberScrollPosition={rememberScrollPosition}
          onRealtimeLatencyChange={handleRealtimeLatencyChange}
          onSearchDisplayModeChange={handleSearchDisplayModeChange}
          onRememberScrollPositionChange={handleRememberScrollPositionChange}
          locale={locale}
          onLocaleChange={handleLocaleChange}
        />

        {/* Per-User Source Settings (visible to all logged-in users) */}
        <UserSourceSettings />

        {/* Per-User Danmaku Settings (visible to all logged-in users) */}
        <UserDanmakuSettings />

        {/* Source Management */}
        <PermissionGate permission="source_management">
          <SourceSettings
            sources={sources}
            onSourcesChange={handleSourcesChange}
            onRestoreDefaults={() => setIsRestoreDefaultsDialogOpen(true)}
            onAddSource={() => {
              setEditingSource(null);
              setIsAddModalOpen(true);
            }}
            onEditSource={handleEditSource}
          />
        </PermissionGate>

        {/* Sort Options */}
        <SortSettings
          sortBy={sortBy}
          onSortChange={handleSortChange}
        />

        {/* Data Management */}
        <PermissionGate permission="data_management">
          <DataSettings
            onExport={() => setIsExportModalOpen(true)}
            onImport={() => setIsImportModalOpen(true)}
            onReset={() => setIsResetDialogOpen(true)}
          />
        </PermissionGate>
      </div>

      {/* Modals */}
      <AddSourceModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingSource(null);
        }}
        onAdd={handleAddSource}
        existingIds={sources.map(s => s.id)}
        initialValues={editingSource}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportFile={handleImportFile}
        onImportLink={handleImportLink}
        subscriptions={subscriptions}
        onAddSubscription={handleAddSubscription}
        onRemoveSubscription={handleRemoveSubscription}
        onRefreshSubscription={handleRefreshSubscription}
      />

      <ConfirmDialog
        isOpen={isRestoreDefaultsDialogOpen}
        title="恢复默认源"
        message="这将重置所有视频源为默认配置。自定义源将被删除。是否继续？"
        confirmText="恢复"
        cancelText="取消"
        onConfirm={handleRestoreDefaults}
        onCancel={() => setIsRestoreDefaultsDialogOpen(false)}
      />

      <ConfirmDialog
        isOpen={isResetDialogOpen}
        title="清除所有数据"
        message="这将删除所有设置、历史记录、Cookie 和缓存。此操作不可撤销。是否继续？"
        confirmText="清除"
        cancelText="取消"
        onConfirm={handleResetAll}
        onCancel={() => setIsResetDialogOpen(false)}
        dangerous
      />
    </div>
  );
}
