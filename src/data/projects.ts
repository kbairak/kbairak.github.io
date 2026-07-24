export interface Project {
  title: string;
  description: string;
  repo: string;
  site?: string;
}

export interface Category {
  name: string;
  projects: Project[];
}

export const categories: Category[] = [
  {
    name: "Python",
    projects: [
      {
        title: "pipepy/pymake",
        description: "Python library for invoking and interacting with shell commands",
        repo: "https://github.com/kbairak/pipepy",
      },
      {
        title: "djsonapi",
        description: "{json:api} server toolkit for Django",
        repo: "https://github.com/kbairak/djsonapi",
        site: "https://kbairak.net/djsonapi/",
      },
      {
        title: "djoutbox",
        description: "Transactional outbox pattern for Django + PostgreSQL + RabbitMQ",
        repo: "https://github.com/kbairak/djoutbox",
        site: "https://kbairak.net/djoutbox/",
      },
      {
        title: "outbox",
        description: "Transactional outbox pattern for Postgres and RabbitMQ",
        repo: "https://github.com/kbairak/outbox",
      },
      {
        title: "symfields",
        description: "Symbolic field relationships with automatic inversion",
        repo: "https://github.com/kbairak/symfields",
      },
      {
        title: "ohk",
        description: "Interactive alternative to grep and awk",
        repo: "https://github.com/kbairak/ohk",
      },
    ],
  },
  {
    name: "Web",
    projects: [
      {
        title: "webmq",
        description: "Real-time messaging framework with WebSockets and RabbitMQ",
        repo: "https://github.com/kbairak/webmq",
      },
      {
        title: "domstatejsx",
        description: "JSX and state-in-DOM web library",
        repo: "https://github.com/kbairak/domstatejsx",
      },
      {
        title: "Space Combat",
        description: "A space combat game",
        repo: "https://github.com/kbairak/spacecombat",
        site: "https://kbairak.net/spacecombat/",
      },
      {
        title: "Dice",
        description: "Dice rolling app",
        repo: "https://github.com/kbairak/dice",
        site: "https://kbairak.net/dice/",
      },
    ],
  },
  {
    name: "(Neo)Vim Plugins",
    projects: [
      {
        title: "ColumnTags",
        description: "Miller Columns navigation plugin for Neovim",
        repo: "https://github.com/kbairak/ColumnTags.nvim",
      },
      {
        title: "TurboMark",
        description: "Mark and find lines in open buffers",
        repo: "https://github.com/kbairak/TurboMark",
      },
      {
        title: "BufferNotebook",
        description: "Interactive Python notebook in Neovim buffers",
        repo: "https://github.com/kbairak/buffernotebook.nvim",
      },
    ],
  },
  {
    name: "Other",
    projects: [
      {
        title: "discord_brackets",
        description: "Playoff bracket tournament bot for Discord",
        repo: "https://github.com/kbairak/discord_brackets",
      },
    ],
  },
];
