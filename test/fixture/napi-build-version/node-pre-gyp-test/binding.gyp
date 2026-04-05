{
  "targets": [
    {
      "target_name": "<(module_name)",
      "sources": ["src/hello.cc"]
    },
    {
      "target_name": "action_after_build",
      "type": "none",
      "dependencies": ["<(module_name)"],
      "copies": [
        {
          "files": ["<(PRODUCT_DIR)/<(module_name).node"],
          "destination": "<(module_path)"
        }
      ]
    }
  ]
}
