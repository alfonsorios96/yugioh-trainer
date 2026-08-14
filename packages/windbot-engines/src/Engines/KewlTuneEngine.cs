// WindBot META engines — GNU Affero GPL v3 or later. See LICENSE.

using System;
using WindBot.Game;
using WindBot.Game.AI;
using YGOSharp.OCGWrapper.Enums;

namespace WindBot.Game.AI.Decks
{
    public static class KewlTuneCardId
    {
        public const int Reco = 89392810;
        public const int Rotary = 17209452;
        public const int Mix = 16509007;
        public const int Cue = 16387555;
        public const int Clip = 43904702;
        public const int Synchro = 78058681;
        public const int JJ = 14442329;
        public const int TrackMaker = 42781164;
        public const int Remix = 88170262;
        public const int RS = 15665977;
        public const int B2B = 65961304;
        public const int LoudnessWar = 41069676;
        public const int Crackle = 39576656;
        public const int Zalen = 4891376;
        public const int Malong = 93125329;
        public const int WindPegasus = 98506199;
    }

    /// <summary>
    /// v1 line: Mix/Reco search Rotary → extra Normal Summon → Track Maker → Remix/RS.
    /// </summary>
    public static class KewlTuneEngine
    {
        public static void Register(MetaExecutor ex)
        {
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.Synchro, SynchroSpell(ex));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.JJ, FieldSpell(ex));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.Rotary, RotaryEffect(ex));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.Mix, MixRecoSearch(ex, KewlTuneCardId.Mix));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.Reco, MixRecoSearch(ex, KewlTuneCardId.Reco));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.Cue, CueEffect(ex));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.Clip, ClipEffect(ex));
            ex.Bind(ExecutorType.Summon, KewlTuneCardId.Mix, DefaultNs(ex));
            ex.Bind(ExecutorType.Summon, KewlTuneCardId.Reco, DefaultNs(ex));
            ex.Bind(ExecutorType.Summon, KewlTuneCardId.Cue, DefaultNs(ex));
            ex.Bind(ExecutorType.Summon, KewlTuneCardId.Rotary, DefaultNs(ex));
            ex.Bind(ExecutorType.Summon, KewlTuneCardId.Clip, DefaultNs(ex));
            ex.Bind(ExecutorType.SpSummon, KewlTuneCardId.TrackMaker, SynchroIfCan(ex));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.TrackMaker, TrackMakerEffect(ex));
            ex.Bind(ExecutorType.SpSummon, KewlTuneCardId.Remix, SynchroIfCan(ex));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.Remix, RemixEffect(ex));
            ex.Bind(ExecutorType.SpSummon, KewlTuneCardId.RS, SynchroIfCan(ex));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.RS, RsEffect(ex));
            ex.Bind(ExecutorType.SpSummon, KewlTuneCardId.LoudnessWar, SynchroIfCan(ex));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.LoudnessWar);
            ex.Bind(ExecutorType.SpSummon, KewlTuneCardId.Crackle, SynchroIfCan(ex));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.Crackle);
            ex.Bind(ExecutorType.SpSummon, KewlTuneCardId.B2B, SynchroIfCan(ex));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.B2B);
            ex.Bind(ExecutorType.SpSummon, KewlTuneCardId.Zalen, SynchroIfCan(ex));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.Zalen, ZalenEffect(ex));
            ex.Bind(ExecutorType.SpSummon, KewlTuneCardId.Malong, SynchroIfCan(ex));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.Malong);
            ex.Bind(ExecutorType.SpSummon, KewlTuneCardId.WindPegasus, SynchroIfCan(ex));
            ex.Bind(ExecutorType.Activate, KewlTuneCardId.WindPegasus);
            ex.Bind(ExecutorType.SpellSet, SpellSet(ex));
            ex.Bind(ExecutorType.Repos, ex.StapleRepos);
        }

        static Func<bool> DefaultNs(MetaExecutor ex)
        {
            return delegate { return true; };
        }

        static Func<bool> SynchroIfCan(MetaExecutor ex)
        {
            return delegate { return true; };
        }

        static Func<bool> SynchroSpell(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CardNegated()) return false;
                if (!ex.FieldBot.HasInHand(KewlTuneCardId.Mix) && !ex.FieldBot.HasInMonstersZone(KewlTuneCardId.Mix))
                    ex.Brain.SelectCard(KewlTuneCardId.Mix, KewlTuneCardId.Rotary, KewlTuneCardId.Reco, KewlTuneCardId.Cue);
                else if (!ex.FieldBot.HasInHand(KewlTuneCardId.Rotary))
                    ex.Brain.SelectCard(KewlTuneCardId.Rotary, KewlTuneCardId.Reco, KewlTuneCardId.Cue, KewlTuneCardId.Clip);
                else
                    ex.Brain.SelectCard(KewlTuneCardId.Reco, KewlTuneCardId.Cue, KewlTuneCardId.Clip, KewlTuneCardId.JJ);
                return true;
            };
        }

        static Func<bool> FieldSpell(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.Location == CardLocation.Hand)
                    return UniqueField(ex);
                ex.Brain.SelectCard(KewlTuneCardId.Rotary, KewlTuneCardId.Mix, KewlTuneCardId.Reco);
                return true;
            };
        }

        static bool UniqueField(MetaExecutor ex)
        {
            foreach (ClientCard card in ex.FieldBot.GetSpells())
            {
                if (card.IsCode(KewlTuneCardId.JJ) && card.IsFaceup())
                    return false;
            }
            return true;
        }

        static Func<bool> RotaryEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.Location == CardLocation.Hand)
                    return true;
                return true;
            };
        }

        static Func<bool> MixRecoSearch(MetaExecutor ex, int self)
        {
            return delegate
            {
                if (ex.CurrentCard.Location != CardLocation.MonsterZone)
                    return ex.CurrentCard.Location == CardLocation.Grave;
                if (self == KewlTuneCardId.Mix)
                    ex.Brain.SelectCard(KewlTuneCardId.Rotary, KewlTuneCardId.Reco, KewlTuneCardId.Cue, KewlTuneCardId.Clip);
                else
                    ex.Brain.SelectCard(KewlTuneCardId.Rotary, KewlTuneCardId.Mix, KewlTuneCardId.Cue, KewlTuneCardId.Clip);
                return true;
            };
        }

        static Func<bool> CueEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.Location == CardLocation.MonsterZone)
                {
                    ex.Brain.SelectCard(KewlTuneCardId.Rotary, KewlTuneCardId.Mix, KewlTuneCardId.Reco, KewlTuneCardId.Clip);
                    return true;
                }
                return true;
            };
        }

        static Func<bool> ClipEffect(MetaExecutor ex)
        {
            return delegate
            {
                return ex.Match.Player == 1 || ex.CurrentCard.Location != CardLocation.Hand;
            };
        }

        static Func<bool> TrackMakerEffect(MetaExecutor ex)
        {
            return delegate
            {
                ex.Brain.SelectCard(KewlTuneCardId.Synchro, KewlTuneCardId.JJ, KewlTuneCardId.Clip, KewlTuneCardId.Reco);
                return true;
            };
        }

        static Func<bool> RemixEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.Match.Player != 1) return false;
                ex.Brain.SelectCard(KewlTuneCardId.Mix, KewlTuneCardId.Reco, KewlTuneCardId.Rotary, KewlTuneCardId.Cue);
                ex.Brain.SelectNextCard(KewlTuneCardId.Reco, KewlTuneCardId.Rotary, KewlTuneCardId.Cue, KewlTuneCardId.Clip);
                return true;
            };
        }

        static Func<bool> RsEffect(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.Match.LastChainPlayer != 1) return false;
                ClientCard target = ex.Helper.GetBestEnemySpell(true);
                if (target == null)
                    target = ex.Helper.GetBestEnemyMonster(true, true);
                if (target == null) return false;
                ex.Brain.SelectCard(KewlTuneCardId.Mix, KewlTuneCardId.Reco, KewlTuneCardId.Rotary);
                ex.Brain.SelectNextCard(target.Id);
                return true;
            };
        }

        static Func<bool> ZalenEffect(MetaExecutor ex)
        {
            return delegate
            {
                return ex.Match.LastChainPlayer == 1;
            };
        }

        static Func<bool> SpellSet(MetaExecutor ex)
        {
            return delegate
            {
                if (ex.CurrentCard.IsCode(StapleCardId.InfiniteImpermanence))
                    return !ex.FieldBot.IsFieldEmpty();
                return false;
            };
        }
    }
}
