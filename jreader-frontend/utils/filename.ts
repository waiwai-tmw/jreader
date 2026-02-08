// Use _U as our escape sequence since underscore is definitely allowed
export function encodeFilename(key: string): string {
    return key
      // First escape the escape sequence itself
      .replace(/_U/g, '_U005f_U0055')
      // Then encode any non-S3-safe character with _U{hex}
      .replace(/[^\w\/!-.*'()& $@=;:+,?]/g, char => 
        '_U' + char.charCodeAt(0).toString(16)
      );
}
  
export function decodeFilename(encoded: string): string {
    return encoded.replace(/_U([0-9a-f]+)/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}