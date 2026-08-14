// WindBot META engines — GNU Affero GPL v3 or later. See LICENSE.

using System;
using WindBot.Game;
using WindBot.Game.AI;

namespace WindBot.Game.AI.Decks
{
    public static class StapleCardId
    {
        public const int AshBlossom = 14558127;
        public const int GhostBelle = 73642296;
        public const int EffectVeiler = 97268402;
        public const int DrollAndLockBird = 94145021;
        public const int InfiniteImpermanence = 10045474;
        public const int CalledByTheGrave = 24224830;
        public const int Nibiru = 27204311;
        public const int MulcharmyFuwalos = 42141493;
        public const int LightningStorm = 14532163;
        public const int HarpiesFeatherDuster = 18144506;
        public const int PotOfDesires = 35261759;
        public const int MaxxC = 23434538;
        public const int GhostOgre = 59438930;
        public const int IPMasquerena = 65741786;
        public const int SPLittleKnight = 29301450;
        public const int KnightmareUnicorn = 38342335;
        public const int KnightmarePhoenix = 2857636;
        public const int Typhon = 93039339;
        public const int AccesscodeTalker = 86066372;
        public const int UnderworldGoddess = 98127546;
        public const int KnightmareCerberus = 75452921;
        public const int RelinquishedAnima = 94259633;
        public const int Avramax = 21887175;
        public const int Almiraj = 60303245;
    }

    /// <summary>
    /// 2026 staple handlers. Ash/Imperm/Maxx C reuse DefaultExecutor;
    /// Mulcharmy / Lightning Storm / Called by get thin META wrappers.
    /// </summary>
    public static class StapleEngine
    {
        public static void Register(MetaExecutor ex)
        {
            RegisterHandtraps(ex);
            RegisterBreakers(ex);
            RegisterExtra(ex);
        }

        /// <summary>
        /// Handtraps first so they win chains over engine GY activations.
        /// </summary>
        public static void RegisterHandtraps(MetaExecutor ex)
        {
            ex.Bind(ExecutorType.Activate, StapleCardId.AshBlossom, ex.StapleAsh);
            ex.Bind(ExecutorType.Activate, StapleCardId.GhostBelle, GhostBelleEffect(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.EffectVeiler, VeilerEffect(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.DrollAndLockBird, DrollEffect(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.InfiniteImpermanence, ex.StapleImperm);
            ex.Bind(ExecutorType.Activate, StapleCardId.CalledByTheGrave, CalledByEffect(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.Nibiru, NibiruEffect(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.MulcharmyFuwalos, FuwalosEffect(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.MaxxC, ex.StapleMaxxC);
            ex.Bind(ExecutorType.Activate, StapleCardId.GhostOgre, GhostOgreEffect(ex));
        }

        public static void RegisterBreakers(MetaExecutor ex)
        {
            ex.Bind(ExecutorType.Activate, StapleCardId.LightningStorm, LightningStormEffect(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.HarpiesFeatherDuster);
            ex.Bind(ExecutorType.Activate, StapleCardId.PotOfDesires, DesiresEffect(ex));
        }

        /// <summary>
        /// Generic extra-deck after the archetype line so Track Maker / rituals win.
        /// </summary>
        public static void RegisterExtra(MetaExecutor ex)
        {
            ex.Bind(ExecutorType.SpSummon, StapleCardId.IPMasquerena, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.IPMasquerena);
            ex.Bind(ExecutorType.SpSummon, StapleCardId.SPLittleKnight, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.SPLittleKnight);
            ex.Bind(ExecutorType.SpSummon, StapleCardId.KnightmarePhoenix, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.KnightmarePhoenix);
            ex.Bind(ExecutorType.SpSummon, StapleCardId.KnightmareUnicorn, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.KnightmareUnicorn);
            ex.Bind(ExecutorType.SpSummon, StapleCardId.Typhon, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.Typhon);
            ex.Bind(ExecutorType.SpSummon, StapleCardId.AccesscodeTalker, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.AccesscodeTalker);
            ex.Bind(ExecutorType.SpSummon, StapleCardId.UnderworldGoddess, ExtraIfCan(ex));
            ex.Bind(ExecutorType.SpSummon, StapleCardId.KnightmareCerberus, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.KnightmareCerberus);
            ex.Bind(ExecutorType.SpSummon, StapleCardId.RelinquishedAnima, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.RelinquishedAnima);
            ex.Bind(ExecutorType.SpSummon, StapleCardId.Avramax, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.Avramax);
            ex.Bind(ExecutorType.SpSummon, StapleCardId.Almiraj, ExtraIfCan(ex));
            ex.Bind(ExecutorType.Activate, StapleCardId.Almiraj);
        }

        static Func<bool> GhostBelleEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                return ex.Match.LastChainPlayer == 1;
            };
        }

        static Func<bool> VeilerEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                return ex.Match.LastChainPlayer == 1 && ex.Match.Player == 1;
            };
        }

        static Func<bool> DrollEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                return ex.Match.LastChainPlayer == 1;
            };
        }

        static Func<bool> CalledByEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.Match.LastChainPlayer != 1) return false;
                ClientCard last = ex.Helper.GetLastChainCard();
                if (last == null || !last.IsMonster()) return false;
                ex.Brain.SelectCard(last.Id);
                return true;
            };
        }

        static Func<bool> NibiruEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                if (ex.Match.Player != 1) return false;
                return ex.FieldEnemy.GetMonsterCount() >= 5;
            };
        }

        static Func<bool> FuwalosEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                if (ex.Match.Player != 1) return false;
                return ex.FieldBot.GetMonsterCount() == 0 && ex.FieldBot.GetSpellCount() == 0;
            };
        }

        static Func<bool> LightningStormEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.FieldBot.GetMonsterCount() > 0) return false;
                return ex.FieldEnemy.GetMonsterCount() >= 2 || ex.FieldEnemy.GetSpellCount() >= 2;
            };
        }

        static Func<bool> DesiresEffect(MetaExecutor ex)
        {
            return delegate { return ex.Match.Player == 0; };
        }

        static Func<bool> GhostOgreEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                return ex.Match.LastChainPlayer == 1;
            };
        }

        static Func<bool> ExtraIfCan(MetaExecutor ex)
        {
            return delegate { return true; };
        }
    }
}
