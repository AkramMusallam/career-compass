function validApiUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && url.hostname !== '[::1]';
  } catch { return false; }
}

if (require.main === module && !validApiUrl(process.env.EXPO_PUBLIC_API_BASE_URL)) {
  console.error('Set EXPO_PUBLIC_API_BASE_URL to the public HTTPS API address in the selected EAS environment.');
  process.exitCode = 1;
}
module.exports = { validApiUrl };
