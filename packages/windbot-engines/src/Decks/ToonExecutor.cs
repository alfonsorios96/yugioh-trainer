// WindBot META engines — GNU Affero GPL v3 or later. See LICENSE.

using System.Collections.Generic;
using WindBot.Game;
using WindBot.Game.AI;

namespace WindBot.Game.AI.Decks
{
    [Deck("Toon2026", "AI_Toon2026")]
    public class ToonExecutor : MetaExecutor
    {
        public ToonExecutor(GameAI ai, Duel duel)
            : base(ai, duel)
        {
            StapleEngine.RegisterHandtraps(this);
            StapleEngine.RegisterBreakers(this);
            ToonEngine.Register(this);
            StapleEngine.RegisterExtra(this);
        }

        public override int OnSelectOption(IList<long> options)
        {
            if (Card != null && Card.IsCode(ToonCardId.FacelessMage))
            {
                if (!Bot.HasInSpellZone(ToonCardId.MindScan, false, true)
                    && !Bot.HasInHand(ToonCardId.MindScan))
                    return 0;
                if (options.Count > 1)
                    return 1;
                return 0;
            }
            return -1;
        }

        public override int OnAnnounceCard(IList<int> avail)
        {
            ClientCard last = Util.GetLastChainCard();
            if (last != null && avail.Contains(last.Id))
                return last.Id;
            return 0;
        }
    }
}
