import { fetchAtlasTodos } from './bc-client.mjs';

const result = await fetchAtlasTodos({
  baseUrl: process.env.ATLAS_TODO_BASE_URL ?? 'http://localhost:4711',
  token: process.env.TODO_BC_READ_TOKEN,
});
console.log(JSON.stringify(result, null, 2));
