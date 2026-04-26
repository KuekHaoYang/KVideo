'use client';

import { Suspense, useMemo, useSyncExternalStore } from 'react';
import { SearchForm } from '@/components/search/SearchForm';
import { NoResults } from '@/components/search/NoResults';
import { PopularFeatures } from '@/components/home/PopularFeatures';
import { FavoritesSidebar } from '@/components/favorites/FavoritesSidebar';
import { Navbar } from '@/components/layout/Navbar';
import { SearchResults } from '@/components/home/SearchResults';
import { useHomePage } from '@/lib/hooks/useHomePage';
import { useLatencyPing } from '@/lib/hooks/useLatencyPing';
import { settingsStore } from '@/lib/store/settings-store';
import { userSourcesStore } from '@/lib/store/user-sources-store';
import { buildLatencySourceUrls } from '@/lib/utils/latency-source-map';

function subscribeToConfiguredSources(listener: () => void) {
  const unsubscribeSettings = settingsStore.subscribe(listener);
  const unsubscribeUserSources = userSourcesStore.subscribe(listener);

  return () => {
    unsubscribeSettings();
    unsubscribeUserSources();
  };
}

function getConfiguredSourcesSnapshot() {
  const settings = settingsStore.getSettings();
  const configuredSources = [...settings.sources, ...userSourcesStore.getSources()]
    .filter((source) => source.enabled !== false)
    .map((source) => ({
      id: source.id,
      baseUrl: source.baseUrl,
    }));

  return JSON.stringify(configuredSources);
}

function HomePage() {
  const {
    query,
    hasSearched,
    loading,
    results,
    availableSources,
    completedSources,
    totalSources,
    handleSearch,
    handleReset,
    handleCancelSearch,
  } = useHomePage();

  const configuredSourcesSnapshot = useSyncExternalStore(
    subscribeToConfiguredSources,
    getConfiguredSourcesSnapshot,
    () => '[]',
  );

  const sourceUrls = useMemo(() => {
    const configuredSources = JSON.parse(configuredSourcesSnapshot) as Array<{
      id: string;
      baseUrl: string;
    }>;

    return buildLatencySourceUrls(availableSources, configuredSources);
  }, [availableSources, configuredSourcesSnapshot]);

  const { latencies } = useLatencyPing({
    sourceUrls,
    enabled: hasSearched && results.length > 0,
  });

  return (
    <div className="min-h-screen">
      <Navbar onReset={handleReset} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-3 sm:mt-5 mb-5 sm:mb-7 relative" style={{
        transform: 'translate3d(0, 0, 0)',
        zIndex: 1000
      }}>
        <SearchForm
          onSearch={handleSearch}
          onClear={handleReset}
          onCancelSearch={handleCancelSearch}
          isLoading={loading}
          initialQuery={query}
          currentSource=""
          checkedSources={completedSources}
          totalSources={totalSources}
        />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        {(results.length >= 1 || (!loading && results.length > 0)) && (
          <SearchResults
            results={results}
            availableSources={availableSources}
            loading={loading}
            latencies={latencies}
          />
        )}

        {!loading && !hasSearched && (
          <PopularFeatures onSearch={handleSearch} />
        )}

        {!loading && hasSearched && results.length === 0 && (
          <NoResults onReset={handleReset} />
        )}
      </main>

      <FavoritesSidebar />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[var(--accent-color)] border-t-transparent"></div>
      </div>
    }>
      <HomePage />
    </Suspense>
  );
}
