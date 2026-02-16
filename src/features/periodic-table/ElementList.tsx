import { useState, useMemo } from 'react';
import type { Element } from '../../types/element';

interface Props {
  elements: Element[];
}

const GROUP_RU: Record<string, string> = {
  alkali_metal: 'Щелочной металл',
  alkaline_earth: 'Щёлочноземельный',
  transition_metal: 'Переходный металл',
  post_transition_metal: 'Постпереходный',
  metalloid: 'Металлоид',
  nonmetal: 'Неметалл',
  halogen: 'Галоген',
  noble_gas: 'Благородный газ',
  lanthanide: 'Лантаноид',
  actinide: 'Актиноид',
};

export default function ElementList({ elements }: Props) {
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
      <h2 className="element-list__title">Все элементы</h2>
      <input
        type="search"
        className="element-list__search"
        placeholder="Поиск по названию, символу или номеру..."
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
            <span className="element-list__item-group">{GROUP_RU[el.element_group] ?? ''}</span>
          </a>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="element-list__empty">Ничего не найдено</p>
      )}
    </div>
  );
}
