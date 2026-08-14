// WindBot META engines — GNU Affero GPL v3 or later. See LICENSE.

using System;
using WindBot.Game;
using WindBot.Game.AI;
using YGOSharp.OCGWrapper.Enums;

namespace WindBot.Game.AI.Decks
{
    public static class ToonCardId
    {
        public const int ComicCat = 72921536;
        public const int FunnyDarkRabbit = 45536531;
        public const int EvilBox = 8915275;
        public const int FacelessMage = 34314989;
        public const int ToonMermaid = 65458948;
        public const int BlueEyesToonDragon = 53183600;
        public const int PerfectWorld = 7293697;
        public const int ToonTableOfContents = 89997728;
        public const int ToonBookmark = 91500017;
        public const int ToonTerror = 53094821;
        public const int MindScan = 34298391;
        public const int ToonWorld = 15259703;
        public const int Terraforming = 73628505;
        public const int DimensionShifter = 91800273;
        public const int DominusImpulse = 40366667;
        public const int BlueEyesToonUltimateDragon = 71808988;
        public const int Dugares = 66011101;
        public const int CrossSheep = 50277355;
        public const int PerfectronHydradrive = 13203964;
        public const int Zealantis = 45112597;
        public const int FirewallDragon = 5043010;
        public const int ProtectcodeTalker = 58036229;
        public const int CharmerQuartet = 27519978;
        public const int Zenna = 7594154;
        public const int CyberseDesavewurm = 92422871;
        public const int Bagooska = 90590303;
        public const int Veidos = 78783557;
        public const int TripleTacticsTalent = 25311006;
        public const int SolemnJudgment = 41420027;
        public const int SolemnWarning = 84749824;
        public const int ChaosTrapHole = 11593137;
    }

    /// <summary>
    /// v1 line: Terraforming/Bookmark/Table → Perfect World → Funny Dark Rabbit extra NS
    /// → Comic Cat tribute into Blue-Eyes Toon / Faceless → Evil Box + Toon Terror
    /// → contact fusion Blue-Eyes Toon Ultimate Dragon. Mind Scan declare-negate.
    /// </summary>
    public static class ToonEngine
    {
        public static void Register(MetaExecutor ex)
        {
            ex.Bind(ExecutorType.Activate, ToonCardId.Terraforming, TerraformingEffect(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.ToonBookmark, BookmarkEffect(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.ToonTableOfContents, TableEffect(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.PerfectWorld, PerfectWorldEffect(ex));
            ex.Bind(ExecutorType.Summon, ToonCardId.FunnyDarkRabbit, DefaultNs(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.FunnyDarkRabbit, RabbitEffect(ex));
            ex.Bind(ExecutorType.Summon, ToonCardId.ComicCat, DefaultNs(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.ComicCat, ComicCatEffect(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.EvilBox, EvilBoxEffect(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.FacelessMage, FacelessEffect(ex));
            ex.Bind(ExecutorType.SpSummon, ToonCardId.ToonMermaid, ToonProcSummon(ex));
            ex.Bind(ExecutorType.SpSummon, ToonCardId.BlueEyesToonDragon, ToonProcSummon(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.ToonTerror, TerrorEffect(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.MindScan, MindScanEffect(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.DimensionShifter, ShifterEffect(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.DominusImpulse, DominusEffect(ex));
            ex.Bind(ExecutorType.SpSummon, ToonCardId.BlueEyesToonUltimateDragon, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.BlueEyesToonUltimateDragon, UltimateEffect(ex));
            BindExtra(ex, ToonCardId.Dugares);
            BindExtra(ex, ToonCardId.CrossSheep);
            BindExtra(ex, ToonCardId.PerfectronHydradrive);
            BindExtra(ex, ToonCardId.Zealantis);
            BindExtra(ex, ToonCardId.FirewallDragon);
            BindExtra(ex, ToonCardId.ProtectcodeTalker);
            BindExtra(ex, ToonCardId.CharmerQuartet);
            BindExtra(ex, ToonCardId.Zenna);
            BindExtra(ex, ToonCardId.CyberseDesavewurm);
            BindExtra(ex, ToonCardId.Bagooska);
            ex.Bind(ExecutorType.Activate, ToonCardId.Veidos, VeidosEffect(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.TripleTacticsTalent, TacticsEffect(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.SolemnJudgment, SolemnJudgmentEffect(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.SolemnWarning, SolemnWarningEffect(ex));
            ex.Bind(ExecutorType.Activate, ToonCardId.ChaosTrapHole, ChaosTrapEffect(ex));
            ex.Bind(ExecutorType.SpellSet, SpellSet(ex));
            ex.Bind(ExecutorType.Repos, ex.StapleRepos);
        }

        static void BindExtra(MetaExecutor ex, int id)
        {
            ex.Bind(ExecutorType.SpSummon, id, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, id);
        }

        static Func<bool> DefaultNs(MetaExecutor ex)
        {
            return delegate { return true; };
        }

        static Func<bool> ExtraIfCan(MetaExecutor ex)
        {
            return delegate { return true; };
        }

        static bool HasToonWorld(MetaExecutor ex)
        {
            return ex.FieldBot.HasInSpellZone(ToonCardId.PerfectWorld, false, true)
                || ex.FieldBot.HasInSpellZone(ToonCardId.ToonWorld, false, true);
        }

        static Func<bool> TerraformingEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                ex.Brain.SelectCard(ToonCardId.PerfectWorld, ToonCardId.ToonWorld);
                return true;
            };
        }

        static Func<bool> BookmarkEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                if (ex.CurrentCard.Location == CardLocation.Grave)
                    return HasToonWorld(ex);
                ex.Brain.SelectCard(
                    ToonCardId.PerfectWorld,
                    ToonCardId.ToonWorld,
                    ToonCardId.FunnyDarkRabbit,
                    ToonCardId.ComicCat,
                    ToonCardId.EvilBox,
                    ToonCardId.FacelessMage);
                return true;
            };
        }

        static Func<bool> TableEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                if (!HasToonWorld(ex))
                    ex.Brain.SelectCard(ToonCardId.PerfectWorld, ToonCardId.ToonBookmark, ToonCardId.FunnyDarkRabbit, ToonCardId.ComicCat);
                else
                    ex.Brain.SelectCard(ToonCardId.ToonBookmark, ToonCardId.FunnyDarkRabbit, ToonCardId.ComicCat, ToonCardId.EvilBox, ToonCardId.ToonTerror);
                return true;
            };
        }

        static Func<bool> PerfectWorldEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                if (ex.CurrentCard.Location == CardLocation.Hand)
                    return !HasToonWorld(ex);
                ex.Brain.SelectCard(
                    ToonCardId.FunnyDarkRabbit,
                    ToonCardId.ComicCat,
                    ToonCardId.FacelessMage,
                    ToonCardId.ToonBookmark,
                    ToonCardId.EvilBox,
                    ToonCardId.ToonTableOfContents,
                    ToonCardId.ToonTerror,
                    ToonCardId.ToonMermaid,
                    ToonCardId.BlueEyesToonDragon,
                    ToonCardId.MindScan);
                return true;
            };
        }

        static Func<bool> RabbitEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.Location != CardLocation.MonsterZone)
                    return false;
                ex.Brain.SelectCard(ToonCardId.PerfectWorld, ToonCardId.ToonWorld, ToonCardId.ToonBookmark);
                return true;
            };
        }

        static Func<bool> ComicCatEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.Location != CardLocation.MonsterZone)
                    return false;
                if (ex.CardNegated()) return false;
                if (HasToonWorld(ex))
                {
                    ClientCard tribute = ex.Helper.GetBestEnemyMonster(true, true);
                    if (tribute != null)
                        ex.Brain.SelectCard(tribute.Id);
                    else
                        ex.Brain.SelectCard(ToonCardId.ComicCat, ToonCardId.FunnyDarkRabbit);
                }
                else
                    ex.Brain.SelectCard(ToonCardId.ComicCat, ToonCardId.FunnyDarkRabbit);
                ex.Brain.SelectNextCard(
                    ToonCardId.BlueEyesToonDragon,
                    ToonCardId.FacelessMage,
                    ToonCardId.ToonMermaid,
                    ToonCardId.FunnyDarkRabbit);
                return true;
            };
        }

        static Func<bool> EvilBoxEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.Location == CardLocation.Hand)
                {
                    if (!HasToonWorld(ex)) return false;
                    ex.Brain.SelectCard(ToonCardId.ToonTerror);
                    return true;
                }
                if (ex.CurrentCard.Location == CardLocation.MonsterZone)
                {
                    if (ex.FieldEnemy.Graveyard.Count > 0)
                        ex.Brain.SelectCard(ex.FieldEnemy.Graveyard[0]);
                    else if (ex.FieldBot.Graveyard.Count > 0)
                        ex.Brain.SelectCard(ex.FieldBot.Graveyard[0]);
                    return true;
                }
                return false;
            };
        }

        static Func<bool> FacelessEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.Location != CardLocation.Hand)
                    return false;
                ex.Brain.SelectCard(
                    ToonCardId.MindScan,
                    ToonCardId.FunnyDarkRabbit,
                    ToonCardId.ComicCat,
                    ToonCardId.BlueEyesToonDragon,
                    ToonCardId.ToonMermaid);
                return true;
            };
        }

        static Func<bool> ToonProcSummon(MetaExecutor ex)
        {
            return delegate { return HasToonWorld(ex); };
        }

        static Func<bool> TerrorEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                if (!HasToonWorld(ex)) return false;
                return ex.Match.LastChainPlayer == 1;
            };
        }

        static Func<bool> MindScanEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                if (ex.CurrentCard.Location == CardLocation.Hand)
                    return true;
                return ex.Match.LastChainPlayer == 1;
            };
        }

        static Func<bool> ShifterEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.Match.Player != 1) return false;
                return ex.FieldBot.Graveyard.Count == 0;
            };
        }

        static Func<bool> DominusEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                return ex.Match.LastChainPlayer == 1;
            };
        }

        static Func<bool> UltimateEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                ex.Brain.SelectCard(
                    ToonCardId.ToonBookmark,
                    ToonCardId.ToonTableOfContents,
                    ToonCardId.PerfectWorld,
                    ToonCardId.ToonTerror,
                    ToonCardId.FunnyDarkRabbit,
                    ToonCardId.ComicCat);
                return true;
            };
        }

        static Func<bool> VeidosEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.Location == CardLocation.Hand)
                    return ex.Match.Player == 0;
                return true;
            };
        }

        static Func<bool> TacticsEffect(MetaExecutor ex)
        {
            return delegate { return ex.Match.Player == 0; };
        }

        static Func<bool> SolemnJudgmentEffect(MetaExecutor ex)
        {
            return delegate { return ex.StapleSolemnJudgment(); };
        }

        static Func<bool> SolemnWarningEffect(MetaExecutor ex)
        {
            return delegate { return ex.StapleSolemnWarning(); };
        }

        static Func<bool> ChaosTrapEffect(MetaExecutor ex)
        {
            return delegate { return ex.StapleTrap(); };
        }

        static Func<bool> SpellSet(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.IsCode(StapleCardId.InfiniteImpermanence))
                    return !ex.FieldBot.IsFieldEmpty();
                if (ex.CurrentCard.IsCode(
                    ToonCardId.ToonTerror,
                    ToonCardId.DominusImpulse,
                    ToonCardId.SolemnJudgment,
                    ToonCardId.SolemnWarning,
                    ToonCardId.ChaosTrapHole))
                    return true;
                return false;
            };
        }
    }
}
