import { startBackend } from '../backend/server.mjs';
import { startFrontend } from '../frontend/server.mjs';

const api = await startBackend();
const frontend = await startFrontend();
function stop() {
  frontend.close();
  api.close();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
