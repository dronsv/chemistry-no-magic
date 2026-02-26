import type { SolubilityRule } from '../../types/rules';
import * as m from '../../paraglide/messages.js';

const RULE_MESSAGE_MAP: Record<string, () => string> = {
  all_nitrates_soluble: m.sol_rule_all_nitrates,
  alkali_salts_soluble: m.sol_rule_alkali_salts,
  ammonium_salts_soluble: m.sol_rule_ammonium_salts,
  halides_soluble_except: m.sol_rule_halides,
  sulfates_soluble_except: m.sol_rule_sulfates,
  carbonates_phosphates_silicates_insoluble: m.sol_rule_carbonates_phosphates,
  hydroxides_insoluble_except: m.sol_rule_hydroxides,
  sulfides_insoluble_except: m.sol_rule_sulfides,
};

interface SolubilityRulesPanelProps {
  rules: SolubilityRule[];
  activeRuleId: string | null;
  onRuleClick: (ruleId: string | null) => void;
}

export default function SolubilityRulesPanel({ rules, activeRuleId, onRuleClick }: SolubilityRulesPanelProps) {
  return (
    <div className="sol-rules-panel">
      <h3 className="sol-rules-panel__title">{m.sol_rules_title()}</h3>
      <div className="sol-rules-panel__list">
        {rules.map(rule => {
          const getMessage = RULE_MESSAGE_MAP[rule.id];
          if (!getMessage) return null;
          const isActive = activeRuleId === rule.id;
          return (
            <button
              key={rule.id}
              type="button"
              className={`sol-rules-panel__item ${isActive ? 'sol-rules-panel__item--active' : ''}`}
              onClick={() => onRuleClick(isActive ? null : rule.id)}
            >
              <span className={`sol-rules-panel__dot sol-rules-panel__dot--${rule.expected}`} />
              {getMessage()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
