export default function rehypeSectionize() {
  return (tree) => {
    if (!tree || !Array.isArray(tree.children)) return;
    const out = [];
    let current = null;
    const pushCurrent = () => { if (current) { out.push(current); current = null; } };
    for (const node of tree.children) {
      if (node.type === 'element' && node.tagName === 'h2') {
        pushCurrent();
        current = { type: 'element', tagName: 'div', properties: { className: ['content-section'] }, children: [node] };
      } else if (current && node.type === 'element' && ['h3','p','ul','ol','pre','blockquote','img','figure','table'].includes(node.tagName)) {
        current.children.push(node);
      } else {
        pushCurrent();
        out.push(node);
      }
    }
    pushCurrent();
    tree.children = out;
  };
}


