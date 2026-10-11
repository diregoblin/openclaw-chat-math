import { toolPluginMetadataSymbol } from 'openclaw/plugin-sdk/tool-plugin';

const schema = { type: 'object', additionalProperties: false, properties: {} };
const plugin = {
  id: 'chat-math',
  name: 'Chat Math',
  description: 'Local LaTeX rendering in the native conversation, without file actions',
  configSchema: { jsonSchema: schema },
  register() {},
};
Object.defineProperty(plugin, toolPluginMetadataSymbol, {
  value: { id: plugin.id, name: plugin.name, description: plugin.description,
    activation: { onStartup: true }, configSchema: schema, tools: [] },
  enumerable: false,
});
export default plugin;
