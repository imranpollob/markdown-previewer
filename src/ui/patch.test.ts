import { describe, expect, it } from 'vitest';
import { patchChildren } from './patch';

describe('patchChildren', () => {
  it('keeps unchanged nodes and replaces only what changed', () => {
    const container = document.createElement('div');
    patchChildren(container, '<p data-line="0">a</p><img data-line="2" src="x.png"><p data-line="4">c</p>');
    const [first, image] = [...container.children];

    patchChildren(container, '<p data-line="0">a!</p><img data-line="2" src="x.png"><p data-line="4">c</p>');

    expect(container.innerHTML).toBe('<p data-line="0">a!</p><img data-line="2" src="x.png"><p data-line="4">c</p>');
    expect(container.children[0]).not.toBe(first);
    expect(container.children[1]).toBe(image);
  });

  it('updates source lines on kept nodes when lines shift', () => {
    const container = document.createElement('div');
    patchChildren(container, '<p data-line="0">a</p><ul data-line="2"><li data-line="2">x</li></ul>');
    const list = container.querySelector('ul');

    patchChildren(container, '<p data-line="0">a</p><p data-line="2">new</p><ul data-line="4"><li data-line="4">x</li></ul>');

    expect(container.querySelector('ul')).toBe(list);
    expect(list?.dataset.line).toBe('4');
    expect(list?.querySelector('li')?.dataset.line).toBe('4');
    expect(container.children).toHaveLength(3);
  });

  it('handles emptying and refilling', () => {
    const container = document.createElement('div');
    patchChildren(container, '<p>a</p>');
    patchChildren(container, '');
    expect(container.innerHTML).toBe('');
    patchChildren(container, '<p>b</p>');
    expect(container.innerHTML).toBe('<p>b</p>');
  });
});
