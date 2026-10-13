import { StyleSheet } from 'react-native';

/** Shared look for the small numeric editors under a picker. */
export const inputStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'flex-end' },
  field: { flex: 1, gap: 4 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 17 },
  setButton: { minHeight: 48, paddingHorizontal: 22, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  setText: { fontSize: 16, fontWeight: '700' },
  error: { fontSize: 13, marginTop: 6 },
});
