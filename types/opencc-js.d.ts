declare module 'opencc-js' {
  interface ConverterOptions {
    from: 'cn' | 'tw' | 'twp' | 'hk' | 'jp';
    to: 'cn' | 'tw' | 'twp' | 'hk' | 'jp';
  }

  export function Converter(options: ConverterOptions): (text: string) => string;
  export function HTMLConverter(
    converter: (text: string) => string,
    rootNode: HTMLElement,
    fromLangTag: string,
    toLangTag: string
  ): void;
}
