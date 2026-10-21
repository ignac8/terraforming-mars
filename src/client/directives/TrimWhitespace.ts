
function trimEmptyTextNodes(el: Node) {
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    const data = node.nodeType === Node.TEXT_NODE ? (node as Text).data : undefined;
    // Vue marks where a list or a multi-node block starts and ends with empty text nodes, and moves
    // the block's nodes relative to them. They take no space, so only real whitespace goes.
    if (data !== undefined && data !== '' && data.trim() === '') {
      node.remove();
      i--;
    }
  }
}

export const trimWhitespace = {
  mounted: trimEmptyTextNodes,
  updated: trimEmptyTextNodes,
};
