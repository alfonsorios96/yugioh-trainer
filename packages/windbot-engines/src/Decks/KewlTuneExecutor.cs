// WindBot META engines — GNU Affero GPL v3 or later. See LICENSE.

using WindBot.Game;
using WindBot.Game.AI;

namespace WindBot.Game.AI.Decks
{
    [Deck("KewlTune", "AI_KewlTune")]
    public class KewlTuneExecutor : MetaExecutor
    {
        public KewlTuneExecutor(GameAI ai, Duel duel)
            : base(ai, duel)
        {
            StapleEngine.RegisterHandtraps(this);
            StapleEngine.RegisterBreakers(this);
            KewlTuneEngine.Register(this);
            StapleEngine.RegisterExtra(this);
        }
    }
}
