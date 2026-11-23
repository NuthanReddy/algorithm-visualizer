// Every snapshot owns its data so later algorithm mutations cannot rewrite history.
export function snapshot(title, description, view, metrics = []) {
  return structuredClone({ title, description, view, metrics });
}

export function defineTopic(spec) {
  return spec;
}

export function buildLesson(spec, exampleIndex = 0) {
  const example = spec.examples[exampleIndex] ?? spec.examples[0];
  const frames = spec.trace(structuredClone(example.input));
  if (!Array.isArray(frames) || frames.length < 2) throw new Error('A lesson trace must have an initial state and an outcome.');
  return {
    spec,
    frames,
    example,
    steps: frames.map((frame, index) => ({
      title: frame.title,
      short: frame.title,
      paragraphs: index === 0 ? [spec.intro, frame.description] : [frame.description],
      noteTitle: index === frames.length - 1 ? 'What to remember' : 'Keep the invariant',
      note: index === frames.length - 1 ? spec.takeaway : spec.invariant,
      tag: index === 0 ? 'THE IDEA' : index === frames.length - 1 ? 'THE RESULT' : 'TRACE THE WORK',
      frame,
    })),
  };
}
