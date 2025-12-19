# AGENTS.md

## Build/Run Commands
- `npm run dev` - Start Vite dev server (port 1420)
- `npm run build` - Type check with vue-tsc then build with Vite
- `npm run tauri dev` - Run Tauri desktop app in development
- `npm run tauri build` - Build Tauri app for production
- No test framework configured

## Code Style
- **Language**: TypeScript with strict mode, Vue 3 Composition API (`<script setup lang="ts">`)
- **Formatting**: 2-space indentation, single quotes for imports, no semicolons in Vue SFCs
- **Imports**: Group by external packages first, then local components, then assets/data
- **Types**: Use TypeScript interfaces for props/emits, define with `defineProps<T>()` and `defineEmits<T>()`
- **Naming**: PascalCase for components, camelCase for variables/functions, kebab-case for CSS classes
- **Components**: Vue SFCs with `<script setup>`, `<template>`, `<style scoped>` order
- **CSS**: Use CSS custom properties from `global.css` (e.g. `--tt-brand-color-500`, `--tt-bg-color`)
- **Dark mode**: Toggle via `.dark` class on `<html>`, use theme-aware CSS variables
- **Rust (Tauri)**: Standard Rust conventions, lib name is `orca_lib`

## Project Notes
- Tauri v2 desktop app with Vue 3 + Vite frontend
- TipTap editor with extensive extensions for rich text
- PrimeVue for UI components with Aura theme
- Use NZ English spelling in user-facing text
