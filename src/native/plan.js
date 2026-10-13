import { Capacitor, registerPlugin } from '@capacitor/core';
export const isNative = Capacitor.isNativePlatform();
export const PlanNative = registerPlugin('PlanNative');
/** Package names that are always reachable while locked (handled natively too). */
export const BUILTIN_ALLOWED = ['Telefon ve arama ekranı', 'WhatsApp aramaları', 'Saat / alarm', 'Ana ekran'];
