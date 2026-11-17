import { invoke } from '@tauri-apps/api/core';
export async function api<T = Record<string, unknown>>(
  name: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  return invoke<T>('api', { name, body });
}
export async function picker(mode: string) {
  return invoke<string | null>('choose_file', { mode });
}
export async function readFile(path: string) {
  return invoke<string>('read_file', { path });
}
export async function saveFile(name: string, text: string) {
  return invoke<boolean>('save_file', { name, text });
}
export async function copyText(text: string) {
  return invoke<void>('copy_secret', { text });
}

export async function clearSecretIfUnchanged(expected: string) {
  return invoke<void>('clear_secret_if_unchanged', { expected });
}

export async function pickIconData() {
  return invoke<string | null>('choose_icon_data');
}
