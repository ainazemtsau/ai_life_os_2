// Dual patterns required: single glob misses nested src directories
module.exports = {
  rules: {
    "no-restricted-imports": ["error", {
      "patterns": [
        {
          "group": ["@ai-life-os/*/src/*"],
          "message": "Import from package index only: '@ai-life-os/package-name' (not internal paths)."
        },
        {
          "group": ["@ai-life-os/*/*/src/*"],
          "message": "Import from package index only: '@ai-life-os/package-name' (not nested internal paths)."
        }
      ]
    }]
  }
};
