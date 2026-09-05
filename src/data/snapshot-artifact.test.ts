import { describe, expect, it } from 'vitest';

import snapshot from './snapshots/16.17.1.json';
import { validateChampionSnapshot } from './snapshot-pipeline';

describe('pinned champion snapshot', () => {
  it('is a valid immutable English snapshot with the reviewed exception index', () => {
    const validated = validateChampionSnapshot(snapshot);
    const jayce = validated.champions.find((champion) => champion.id === 'jayce');
    const hwei = validated.champions.find((champion) => champion.id === 'hwei');
    const elise = validated.champions.find((champion) => champion.id === 'elise');
    const nidalee = validated.champions.find((champion) => champion.id === 'nidalee');
    const gnar = validated.champions.find((champion) => champion.id === 'gnar');
    const shyvana = validated.champions.find((champion) => champion.id === 'shyvana');
    const reksai = validated.champions.find((champion) => champion.id === 'rek-sai');
    const kled = validated.champions.find((champion) => champion.id === 'kled');
    const kayn = validated.champions.find((champion) => champion.id === 'kayn');
    const viego = validated.champions.find((champion) => champion.id === 'viego');

    expect(validated.dataDragonVersion).toBe('16.17.1');
    expect(validated.locale).toBe('en_US');
    expect(validated.champions).toHaveLength(173);
    expect(validated.indexes.excludedChampionIds).toEqual(['aphelios']);
    expect(jayce?.variants.map((variant) => variant.id)).toEqual(['jayce-hammer', 'jayce-cannon']);
    expect(jayce?.variants[0]?.components.body.bodyStats).toMatchObject({
      attackRange: 125,
      attackType: 'melee',
    });
    expect(jayce?.variants[1]?.components.body.bodyStats).toMatchObject({
      attackRange: 500,
      attackType: 'ranged',
    });
    expect(jayce?.variants[0]?.components.q.cooldown?.values).toEqual([16, 14, 12, 10, 8, 6]);
    expect(jayce?.variants[1]?.components.q.cooldown?.values).toEqual([8, 8, 8, 8, 8, 8]);
    expect(jayce?.variants[1]?.components.q.range?.values).toEqual([
      1050, 1050, 1050, 1050, 1050, 1050,
    ]);
    expect(jayce?.variants[1]?.components.q.sourceRefs).toContain(
      'https://raw.communitydragon.org/16.17/game/data/characters/jayce/jayce.bin.json',
    );
    expect(hwei?.variants).toHaveLength(1);
    expect(hwei?.variants[0]?.components.q.carriedMechanics).toContainEqual(
      expect.objectContaining({ id: 'hwei-disaster-spellbook' }),
    );
    expect(hwei?.variants[0]?.components.q.values.some((value) => /cost/i.test(value.label))).toBe(
      false,
    );
    expect(hwei?.variants[0]?.components.q.fullDescription).not.toContain('<');
    expect(elise?.variants.map((variant) => variant.id)).toEqual(['elise-human', 'elise-spider']);
    expect(elise?.variants[0]?.components.body.bodyStats).toMatchObject({
      attackRange: 550,
      attackType: 'ranged',
      movementSpeed: 330,
    });
    expect(elise?.variants[1]?.components.body.bodyStats).toMatchObject({
      attackRange: 125,
      attackType: 'melee',
      movementSpeed: 355,
    });
    expect(elise?.variants[1]?.components.q.values).toContainEqual({
      label: 'Target Missing HP Damage',
      values: [8, 8, 8, 8, 8, 8],
    });
    expect(elise?.variants[1]?.components.e.values).toContainEqual({
      label: 'P Bonus Increase',
      values: [40, 55, 70, 85, 100, 115],
    });
    expect(
      elise?.variants.every(
        (variant) => variant.components.r.availability.status === 'unavailable',
      ),
    ).toBe(true);
    expect(
      elise?.variants.every(
        (variant) => variant.components.passive.availability.status === 'unavailable',
      ),
    ).toBe(true);
    expect(nidalee?.variants.map((variant) => variant.id)).toEqual([
      'nidalee-human',
      'nidalee-cougar',
    ]);
    expect(nidalee?.variants[0]?.components.body.bodyStats).toMatchObject({
      attackRange: 525,
      attackType: 'ranged',
      movementSpeed: 335,
    });
    expect(nidalee?.variants[1]?.components.body.bodyStats).toMatchObject({
      attackRange: 125,
      attackType: 'melee',
      movementSpeed: 335,
    });
    expect(nidalee?.variants[0]?.components.q.values).toContainEqual({
      label: 'Spear Maximum Damage',
      values: [227.5, 292.5, 357.5, 422.5, 487.5, 552.5],
    });
    expect(nidalee?.variants[1]?.components.q.values).toContainEqual({
      label: 'Takedown Base Damage',
      values: [5, 30, 55, 80, 105, 130],
    });
    expect(nidalee?.variants[1]?.components.w.values).toContainEqual({
      label: 'Pounce Damage',
      values: [55, 100, 145, 190, 235, 280],
    });
    expect(nidalee?.variants[1]?.components.e.values).toContainEqual({
      label: 'Swipe Damage',
      values: [70, 130, 190, 250, 310, 370],
    });
    expect(nidalee?.variants[1]?.components.q.cooldown?.values).toEqual([6, 6, 6, 6, 6, 6]);
    expect(nidalee?.variants[1]?.components.q.range?.values).toEqual([
      500, 500, 500, 500, 500, 500,
    ]);
    expect(
      nidalee?.variants.every(
        (variant) => variant.components.r.availability.status === 'unavailable',
      ),
    ).toBe(true);
    expect(
      nidalee?.variants.every(
        (variant) => variant.components.passive.availability.status === 'unavailable',
      ),
    ).toBe(true);
    expect(gnar?.variants.map((variant) => variant.id)).toEqual(['gnar-mini', 'gnar-mega']);
    expect(gnar?.variants[0]?.components.body.bodyStats).toMatchObject({
      attackRange: 387.5,
      attackType: 'ranged',
      movementSpeed: 335,
    });
    expect(gnar?.variants[1]?.components.body.bodyStats).toMatchObject({
      attackRange: 175,
      attackType: 'melee',
      movementSpeed: 335,
    });
    expect(gnar?.variants[0]?.components.q.values).toContainEqual({
      label: 'Mini Base Damage',
      values: [5, 45, 85, 125, 165, 205],
    });
    expect(gnar?.variants[1]?.components.q.values).toContainEqual({
      label: 'Mega Slow Amount',
      values: [30, 35, 40, 45, 50, 55],
    });
    expect(gnar?.variants[1]?.components.w.values).toContainEqual({
      label: 'Mega Stun Duration',
      values: [1.25, 1.25, 1.25, 1.25, 1.25, 1.25],
    });
    expect(gnar?.variants[1]?.components.e.values).toContainEqual({
      label: 'Mega Damage',
      values: [80, 115, 150, 185, 220, 255],
    });
    expect(gnar?.variants[0]?.components.r.availability.status).toBe('unavailable');
    expect(gnar?.variants[1]?.components.r.availability.status).toBe('available');
    expect(
      gnar?.variants.every(
        (variant) => variant.components.passive.availability.status === 'unavailable',
      ),
    ).toBe(true);
    expect(shyvana?.variants.map((variant) => variant.id)).toEqual(['shyvana-default']);
    expect(shyvana?.variants[0]?.components.r.carriedMechanics).toContainEqual(
      expect.objectContaining({ id: 'shyvana-dragon-form' }),
    );
    expect(shyvana?.variants[0]?.components.passive.carriedMechanics).toContainEqual(
      expect.objectContaining({ id: 'shyvana-scalemail' }),
    );
    expect(reksai?.variants.map((variant) => variant.id)).toEqual(['rek-sai-default']);
    expect(reksai?.variants[0]?.components.w.carriedMechanics).toContainEqual(
      expect.objectContaining({ id: 'reksai-burrow-state' }),
    );
    expect(kled?.variants.map((variant) => variant.id)).toEqual(['kled-mounted']);
    expect(kled?.variants[0]?.components.passive.availability.status).toBe('unavailable');
    expect(kled?.variants[0]?.components.q.fullDescription).not.toContain('Pocket Pistol');
    expect(kayn?.variants.map((variant) => variant.id)).toEqual([
      'kayn-rhaast',
      'kayn-shadow-assassin',
    ]);
    expect(kayn?.variants[0]?.components.q.values).toContainEqual(
      expect.objectContaining({ label: 'Slayer Base Max HP Damage' }),
    );
    expect(kayn?.variants[1]?.components.w.sourceRefs).toContain(
      'https://raw.communitydragon.org/16.17/game/data/characters/kayn/kayn.bin.json',
    );
    expect(viego?.variants.map((variant) => variant.id)).toEqual(['viego-default']);
    expect(viego?.variants[0]?.components.passive.availability.status).toBe('unavailable');
  });
});
