import { topics as collections } from './topics-collections.js';
import { topics as graphs } from './topics-graphs.js';
import { topics as optimization } from './topics-optimization.js';
import { inventory } from './curriculum.js';

export const topics = { ...collections, ...graphs, ...optimization };
const expected = inventory.filter(topic => topic.id !== 'big-o');
if (Object.keys(topics).length !== expected.length || expected.some(topic => !topics[topic.id])) {
  throw new Error('The lesson catalog does not match the complete course inventory.');
}
