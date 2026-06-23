/** Expo push tokens issued by `getExpoPushTokenAsync`. */
export function isValidExpoPushToken(token: string): boolean {
  const trimmed = token.trim();
  return (
    trimmed.startsWith('ExponentPushToken[') ||
    trimmed.startsWith('ExpoPushToken[')
  );
}
