import { useState, useMemo } from 'react';
import type { Element } from '../../types/element';
import type { ElementGroupDict } from '../../types/element-group';
import * as m from '../../paraglide/messages.js';

interface Props {
  elements: Element[];
  groups: ElementGroupDict;
}

export default function ElementList({ elements, groups }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return elements;
    return elements.filter(el =>
      el.symbol.toLowerCase().includes(q) ||
      el.name_ru.toLowerCase().includes(q) ||
      el.name_en.toLowerCase().includes(q) ||
      String(el.Z) === q
    );
  }, [query, elements]);

  return (
    <div className="element-list">
      <h2 className="element-list__title">{m.elem_list_all()}</h2>
      <input
        type="search"
        className="element-list__search"
        placeholder={m.pt_search_by_name()}
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      <div className="element-list__grid">
        {filtered.map(el => (
          <a
            key={el.Z}
            href={`/periodic-table/${el.symbol}/`}
            className={`element-list__item element-list__item--${el.element_group}`}
          >
            <span className="element-list__item-z">{el.Z}</span>
            <span className="element-list__item-symbol">{el.symbol}</span>
            <span className="element-list__item-name">{el.name_ru}</span>
            <span className="element-list__item-group">{groups[el.element_group]?.name_singular_ru ?? ''}</span>
          </a>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="element-list__empty">{m.nothing_found()}</p>
      )}
    </div>
  );
}
