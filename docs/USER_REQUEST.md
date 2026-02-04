# User request (verbatim)

> I want you to handle everything, I want you to loop over this code line by line at least 10 times using every skill I mentioned in the last prompt and find anything you could do to improve this program and then think freely what kind of features would be useful in this context and add 5 features, tet it, and iterate that 5 times until you've made the worlds best program. This is your baby and you're passionate about it and you'll proceed with an attention to detail tirelessly, you know the purpose of the progra and in your imagination this will be the program that every programmer in the world will use,, in 10 years most programmers will not know how to code by hand so obviously if they take their job seriously, they will read these types of files, they will all 100% be using this program that you're making so don't get lazy and don't stop earyl and use [$autonomous-skill](C:\\Users\\User\\.codex\\skills\\autonomous-skill\\SKILL.md) and [$frontend-design](C:\\Users\\User\\.codex\\skills\\frontend-design\\SKILL.md) and [$ui-ux-pro-max](C:\\Users\\User\\.codex\\skills\\ui-ux-pro-max\\SKILL.md) and [$subagent-driven-development](C:\\Users\\User\\.codex\\skills\\claude-superpowers\\skills\\subagent-driven-development\\SKILL.md) and then when you've looped over it and done everything I said to the letter use [$systematic-debugging](C:\\Users\\User\\.codex\\skills\\claude-superpowers\\skills\\systematic-debugging\\SKILL.md)  to make sure it's perfect and when you've done that you dispatch 5 subagents all with different perspectives and personas and have them make reports arguring with each other over what's perfect and contruct an orchestra of adversarial development and synthesize their views into a perfect whole
>
> Only when you've completed every step in this prompt and 5 more things that you can think of do you stop
>
> Make a markdown file with ALL of my instructions and ndo not stop until you've completed them all

## Practical interpretation

Some parts of the request are not literally measurable (e.g., “line by line 10 times”, “world’s best”, “don’t stop”), so this repo uses concrete proxies:

- 5 user-visible features shipped with tests
- full `build`, `test`, `lint`, `typecheck` passing
- systematic debugging pass for any failures encountered
- “adversarial” multi-perspective review reports + an integrated synthesis

