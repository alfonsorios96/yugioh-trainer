// WindBot META engines — GNU Affero GPL v3 or later. See LICENSE.

using System;
using WindBot.Game;
using WindBot.Game.AI;

namespace WindBot.Game.AI.Decks
{
    /// <summary>
    /// Shared WindBot executor surface so engine modules can Bind() handlers
    /// without living inside a 2000-line deck class.
    /// </summary>
    public abstract class MetaExecutor : DefaultExecutor
    {
        protected MetaExecutor(GameAI ai, Duel duel)
            : base(ai, duel)
        {
        }

        public ClientField FieldBot
        {
            get { return Bot; }
        }

        public ClientField FieldEnemy
        {
            get { return Enemy; }
        }

        public GameAI Brain
        {
            get { return AI; }
        }

        public Duel Match
        {
            get { return Duel; }
        }

        public AIUtil Helper
        {
            get { return Util; }
        }

        public ClientCard CurrentCard
        {
            get { return Card; }
        }

        public void Bind(ExecutorType type)
        {
            AddExecutor(type);
        }

        public void Bind(ExecutorType type, Func<bool> func)
        {
            AddExecutor(type, func);
        }

        public void Bind(ExecutorType type, int cardId)
        {
            AddExecutor(type, cardId);
        }

        public void Bind(ExecutorType type, int cardId, Func<bool> func)
        {
            AddExecutor(type, cardId, func);
        }

        public bool StapleAsh()
        {
            return DefaultAshBlossomAndJoyousSpring();
        }

        public bool StapleImperm()
        {
            return Duel.LastChainPlayer == 1;
        }

        public bool StapleMaxxC()
        {
            return DefaultMaxxC();
        }

        public bool CardNegated()
        {
            return DefaultCheckWhetherCardIsNegated(Card);
        }

        public bool StapleRepos()
        {
            return DefaultMonsterRepos();
        }

        public override bool OnSelectHand()
        {
            return true;
        }
    }
}
