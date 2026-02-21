import { defineMiddleware } from 'astro:middleware';
import { setLocale, assertIsLocale } from './paraglide/runtime.js';

export const onRequest = defineMiddleware((context, next) => {
  if (context.currentLocale) {
    setLocale(assertIsLocale(context.currentLocale));
  }
  return next();
});
