import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'ZZZ Mod Hub',
  description:
    'The Modern Mod Manager for Zenless Zone Zero — User Guides & 3DMigoto Documentation',
  base: '/ZZZ-Mod-Hub/',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', href: '/ZZZ-Mod-Hub/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#ff7700' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'en' }],
    ['meta', { property: 'og:title', content: 'ZZZ Mod Hub — In-Depth Documentation' }],
    ['meta', { property: 'og:site_name', content: 'ZZZ Mod Hub' }],
    ['meta', { property: 'og:image', content: '/ZZZ-Mod-Hub/logo.png' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Comprehensive guides, tool tutorials, and 3DMigoto modding reference for Zenless Zone Zero.',
      },
    ],
  ],

  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'ZZZ Mod Hub',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Quick Start', link: '/guides/getting-started' },
      {
        text: 'User Guides',
        items: [
          { text: 'Installing & Managing Mods', link: '/guides/mod-management' },
          { text: 'Category Folders & Search', link: '/guides/folders-and-categories' },
          { text: 'Profiles & Presets', link: '/guides/profiles' },
          { text: '3D Mesh Viewer', link: '/guides/3d-viewer' },
          { text: '3-Mode Mod Splitter', link: '/guides/mod-splitter' },
          { text: 'Mod Fixer & Upgrades', link: '/guides/mod-fixer' },
          { text: 'Backups & Operation History', link: '/guides/backups-and-history' },
          { text: 'GameBanana Discover Feed', link: '/guides/gamebanana' },
          { text: 'Card Appearance & Themes', link: '/guides/customization' },
          { text: 'Performance Modes', link: '/guides/performance' },
          { text: 'Troubleshooting & Badges', link: '/guides/troubleshooting' },
        ],
      },
      { text: 'INI Reference', link: '/ini/' },
      { text: 'Troubleshooting', link: '/guides/troubleshooting' },
    ],

    sidebar: {
      '/guides/': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Quick Start & Setup', link: '/guides/getting-started' },
            { text: 'Performance Modes', link: '/guides/performance' },
          ],
        },
        {
          text: 'Mod Management',
          collapsed: false,
          items: [
            { text: 'Installing & Managing Mods', link: '/guides/mod-management' },
            { text: 'Categories & Custom Folders', link: '/guides/folders-and-categories' },
            { text: 'Profiles & Presets', link: '/guides/profiles' },
          ],
        },
        {
          text: 'Advanced Tools',
          collapsed: false,
          items: [
            { text: '3D Mesh Viewer', link: '/guides/3d-viewer' },
            { text: '3-Mode Mod Splitter', link: '/guides/mod-splitter' },
            { text: 'Mod Fixer Engine', link: '/guides/mod-fixer' },
            { text: 'Backups & Operation History', link: '/guides/backups-and-history' },
          ],
        },
        {
          text: 'Customization & Discovery',
          collapsed: false,
          items: [
            { text: 'GameBanana Integration', link: '/guides/gamebanana' },
            { text: 'Card Customizer & Themes', link: '/guides/customization' },
            { text: 'Troubleshooting & Warning Badges', link: '/guides/troubleshooting' },
          ],
        },
      ],
      '/ini/': [
        {
          text: '3DMigoto INI Reference',
          collapsed: false,
          items: [
            { text: 'Architecture Overview', link: '/ini/' },
            { text: 'Constants & Variables', link: '/ini/constants' },
            { text: 'Texture Overrides', link: '/ini/override' },
            { text: 'Shader Overrides', link: '/ini/shader-override' },
            { text: 'Custom Shaders', link: '/ini/custom-shader' },
            { text: 'Resources & Buffers', link: '/ini/resource' },
            { text: 'CommandLists', link: '/ini/command-list' },
            { text: 'Keybinds & Cycles', link: '/ini/key' },
            { text: 'Modifiers', link: '/ini/modifiers' },
            { text: 'Operators', link: '/ini/operators' },
            { text: 'Namespaces', link: '/ini/namespace' },
            { text: 'Properties Reference', link: '/ini/properties' },
            { text: 'Present Section', link: '/ini/present' },
            { text: 'INI Script Troubleshooting', link: '/ini/troubleshooting' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/the-sea-man/ZZZ-Mod-Hub' }],

    search: {
      provider: 'local',
      options: {
        detailedView: true,
      },
    },

    footer: {
      message: 'Released under the GNU GPL v3 License. Independent utility for Zenless Zone Zero.',
      copyright: 'Copyright © 2024-2026 ZZZ Mod Hub Team',
    },

    editLink: {
      pattern: 'https://github.com/the-sea-man/ZZZ-Mod-Hub/edit/main/docs/:path',
      text: 'Suggest changes to this page',
    },
  },
});
