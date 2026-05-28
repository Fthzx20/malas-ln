TipTap Editor Integration

This project includes a client-only TipTap editor component at `app/components/editor/TiptapEditor.client.vue`.

To enable the editor locally, install the TipTap packages:

```bash
npm install @tiptap/core @tiptap/starter-kit
```

Notes:
- The editor lazy-loads in the browser; server-side rendering falls back to `UiTextarea`.
- Drafts are saved to IndexedDB under database `rano-editor` and object store `drafts`.
- The manuscripts editor uses `storageKey` based on `chapterId` or `novelId`.
