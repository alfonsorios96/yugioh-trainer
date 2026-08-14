// WindBot META engines — GNU Affero GPL v3 or later. See LICENSE.

using System;
using WindBot.Game;
using WindBot.Game.AI;
using YGOSharp.OCGWrapper.Enums;

namespace WindBot.Game.AI.Decks
{
    public static class LadrCardId
    {
        public const int BlackChaos = 98684220;
        public const int SoldierOfLightAndDarkness = 70405001;
        public const int MagicianOfDarkChaos = 44001993;
        public const int CelticMystic = 50073633;
        public const int Griffoh = 97462632;
        public const int SkullArchfiend = 24088928;
        public const int LightAndDarknessRitual = 33599853;
        public const int MindShuffle = 24749710;
        public const int ChaosMysticBox = 75983808;
        public const int ChaosMagicalHats = 2372506;
        public const int SpellShatteringSword = 77456448;
        public const int PrePreparationOfRites = 13048472;
        public const int PreparationOfRites = 96729612;
        public const int Manju = 95492061;
        public const int DynaMondo = 73898890;
        public const int ChaosAngel = 22850702;
        public const int HeraldOfTheArcLight = 79606837;
        public const int Linkuriboh = 41999284;
    }

    /// <summary>
    /// Pure Light and Darkness Ritual: Pre-Prep/Manju/Celtic → Griffoh full tribute →
    /// Magician of Dark Chaos or BLS → Mind Shuffle loop. No Azamina/Branded.
    /// </summary>
    public static class LightAndDarknessEngine
    {
        public static void Register(MetaExecutor ex)
        {
            ex.Bind(ExecutorType.Activate, LadrCardId.PrePreparationOfRites, PrePrep(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.PreparationOfRites, Prep(ex));
            ex.Bind(ExecutorType.Summon, LadrCardId.Manju, DefaultNs(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.Manju, ManjuEffect(ex));
            ex.Bind(ExecutorType.Summon, LadrCardId.CelticMystic, DefaultNs(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.CelticMystic, CelticEffect(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.Griffoh, GriffohEffect(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.BlackChaos, BlackChaosEffect(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.SkullArchfiend, SkullEffect(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.LightAndDarknessRitual, RitualSpell(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.MagicianOfDarkChaos, RitualBoss(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.SoldierOfLightAndDarkness, RitualBoss(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.MindShuffle, MindShuffleEffect(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.SpellShatteringSword, SwordEffect(ex));
            ex.Bind(ExecutorType.SpSummon, LadrCardId.DynaMondo, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.DynaMondo);
            ex.Bind(ExecutorType.SpSummon, LadrCardId.ChaosAngel, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.ChaosAngel);
            ex.Bind(ExecutorType.SpSummon, LadrCardId.HeraldOfTheArcLight, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.HeraldOfTheArcLight);
            ex.Bind(ExecutorType.SpSummon, LadrCardId.Linkuriboh, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, LadrCardId.Linkuriboh);
            ex.Bind(ExecutorType.SpellSet, SpellSet(ex));
            ex.Bind(ExecutorType.Repos, ex.StapleRepos);
        }

        static Func<bool> DefaultNs(MetaExecutor ex)
        {
            return delegate { return true; };
        }

        static Func<bool> ExtraIfCan(MetaExecutor ex)
        {
            return delegate { return true; };
        }

        static Func<bool> PrePrep(MetaExecutor ex)
        {
            return delegate
            {
                ex.Brain.SelectCard(LadrCardId.LightAndDarknessRitual);
                ex.Brain.SelectNextCard(LadrCardId.MagicianOfDarkChaos, LadrCardId.SoldierOfLightAndDarkness);
                return true;
            };
        }

        static Func<bool> Prep(MetaExecutor ex)
        {
            return delegate
            {
                ex.Brain.SelectCard(LadrCardId.MagicianOfDarkChaos, LadrCardId.SoldierOfLightAndDarkness);
                return true;
            };
        }

        static Func<bool> ManjuEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (!ex.FieldBot.HasInHand(LadrCardId.LightAndDarknessRitual))
                    ex.Brain.SelectCard(LadrCardId.LightAndDarknessRitual, LadrCardId.MagicianOfDarkChaos);
                else
                    ex.Brain.SelectCard(LadrCardId.MagicianOfDarkChaos, LadrCardId.SoldierOfLightAndDarkness);
                return true;
            };
        }

        static Func<bool> CelticEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.Location == CardLocation.MonsterZone)
                {
                    if (ex.FieldBot.HasInHand(LadrCardId.LightAndDarknessRitual) ||
                        ex.FieldBot.HasInHand(LadrCardId.MagicianOfDarkChaos) ||
                        ex.FieldBot.HasInHand(LadrCardId.Griffoh) ||
                        ex.FieldBot.HasInHand(LadrCardId.BlackChaos) ||
                        ex.FieldBot.HasInHand(LadrCardId.MindShuffle))
                        return true;
                    return true;
                }
                return true;
            };
        }

        static Func<bool> GriffohEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.Location == CardLocation.Hand)
                {
                    ex.Brain.SelectCard(LadrCardId.MindShuffle, LadrCardId.SpellShatteringSword, LadrCardId.ChaosMysticBox);
                    return true;
                }
                return true;
            };
        }

        static Func<bool> BlackChaosEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.Location == CardLocation.Hand)
                {
                    if (ex.FieldBot.HasInMonstersZone(LadrCardId.MagicianOfDarkChaos) ||
                        ex.FieldBot.HasInMonstersZone(LadrCardId.SoldierOfLightAndDarkness))
                    {
                        ex.Brain.SelectCard(LadrCardId.MindShuffle);
                        return true;
                    }
                    return true;
                }
                if (ex.FieldEnemy.GetMonsterCount() + ex.FieldEnemy.GetSpellCount() >= 2)
                    return true;
                return ex.FieldEnemy.GetMonsterCount() + ex.FieldEnemy.GetSpellCount() >= 1;
            };
        }

        static Func<bool> SkullEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.Location == CardLocation.Grave || ex.CurrentCard.Location == CardLocation.Hand)
                {
                    ex.Brain.SelectCard(LadrCardId.LightAndDarknessRitual, LadrCardId.Griffoh, LadrCardId.MagicianOfDarkChaos);
                    return true;
                }
                ex.Brain.SelectCard(LadrCardId.LightAndDarknessRitual);
                ex.Brain.SelectNextCard(LadrCardId.MagicianOfDarkChaos, LadrCardId.SoldierOfLightAndDarkness);
                return true;
            };
        }

        static Func<bool> RitualSpell(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.Location == CardLocation.Grave)
                {
                    ex.Brain.SelectCard(LadrCardId.LightAndDarknessRitual);
                    ex.Brain.SelectNextCard(LadrCardId.Griffoh, LadrCardId.CelticMystic, LadrCardId.MagicianOfDarkChaos);
                    return true;
                }
                bool wantSoldier = ex.FieldEnemy.GetMonsterCount() + ex.FieldEnemy.GetSpellCount() > 0;
                if (wantSoldier && ex.FieldBot.HasInHand(LadrCardId.SoldierOfLightAndDarkness))
                    ex.Brain.SelectCard(LadrCardId.SoldierOfLightAndDarkness);
                else
                    ex.Brain.SelectCard(LadrCardId.MagicianOfDarkChaos, LadrCardId.SoldierOfLightAndDarkness);
                if (ex.FieldBot.HasInHand(LadrCardId.Griffoh) || ex.FieldBot.HasInMonstersZone(LadrCardId.Griffoh))
                    ex.Brain.SelectNextCard(LadrCardId.Griffoh);
                else
                    ex.Brain.SelectNextCard(LadrCardId.CelticMystic, LadrCardId.Manju, LadrCardId.SkullArchfiend);
                return true;
            };
        }

        static Func<bool> RitualBoss(MetaExecutor ex)
        {
            return delegate
            {
                ClientCard target = ex.Helper.GetBestEnemyMonster(true, true);
                if (target == null)
                    target = ex.Helper.GetBestEnemySpell(true);
                if (target == null) return false;
                ex.Brain.SelectCard(target.Id);
                return true;
            };
        }

        static Func<bool> MindShuffleEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.Match.LastChainPlayer == 1 &&
                    (ex.FieldBot.HasInMonstersZone(LadrCardId.MagicianOfDarkChaos) ||
                     ex.FieldBot.HasInMonstersZone(LadrCardId.SoldierOfLightAndDarkness) ||
                     ex.FieldBot.HasInMonstersZone(LadrCardId.BlackChaos)))
                {
                    ex.Brain.SelectCard(LadrCardId.MagicianOfDarkChaos, LadrCardId.SoldierOfLightAndDarkness, LadrCardId.BlackChaos);
                    ex.Brain.SelectNextCard(LadrCardId.BlackChaos, LadrCardId.SoldierOfLightAndDarkness, LadrCardId.MagicianOfDarkChaos);
                    return true;
                }
                ex.Brain.SelectCard(LadrCardId.Griffoh, LadrCardId.CelticMystic, LadrCardId.BlackChaos, LadrCardId.SkullArchfiend);
                return true;
            };
        }

        static Func<bool> SwordEffect(MetaExecutor ex)
        {
            return delegate
            {
                return ex.FieldEnemy.GetSpellCount() >= 1 || ex.FieldEnemy.GetMonsterCount() >= 1;
            };
        }

        static Func<bool> SpellSet(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.IsCode(LadrCardId.MindShuffle))
                    return true;
                if (ex.CurrentCard.IsCode(StapleCardId.InfiniteImpermanence))
                    return !ex.FieldBot.IsFieldEmpty();
                return false;
            };
        }
    }
}
