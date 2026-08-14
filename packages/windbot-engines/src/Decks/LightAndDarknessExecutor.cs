// WindBot META engines — GNU Affero GPL v3 or later. See LICENSE.

using WindBot.Game;
using WindBot.Game.AI;

namespace WindBot.Game.AI.Decks
{
    [Deck("LightAndDarkness", "AI_LightAndDarkness")]
    public class LightAndDarknessExecutor : MetaExecutor
    {
        public LightAndDarknessExecutor(GameAI ai, Duel duel)
            : base(ai, duel)
        {
            StapleEngine.RegisterHandtraps(this);
            StapleEngine.RegisterBreakers(this);
            LightAndDarknessEngine.Register(this);
            StapleEngine.RegisterExtra(this);
        }
    }
}
