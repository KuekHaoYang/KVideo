interface SourceIdentifier {
  id: string;
}

interface ConfiguredSource extends SourceIdentifier {
  baseUrl: string;
}

export function buildLatencySourceUrls(
  availableSources: SourceIdentifier[],
  configuredSources: ConfiguredSource[],
): ConfiguredSource[] {
  const baseUrlById = new Map(configuredSources.map((source) => [source.id, source.baseUrl]));

  return availableSources.flatMap((source) => {
    const baseUrl = baseUrlById.get(source.id);
    return baseUrl ? [{ id: source.id, baseUrl }] : [];
  });
}
