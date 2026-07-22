import { RostersMap } from './types';

export const PREDEFINED_SUGGESTIONS = {
  members: [
    "Chidera",
    "Christopher",
    "Judith",
    "Mimi",
    "Ofonime",
    "Ola",
    "Olayinka",
    "Oluchi",
    "Opeyemi",
    "Prince",
    "Segun"
  ],
  events: [
    "Morning Prayer",
    "Evening Devotional: Hymns",
    "Fasting & Prayer Meeting",
    "Theme Exposition",
    "Bible Study",
    "Discussion Night",
    "Game Night",
    "Praise & Worship",
    "Opening Prayer",
    "Testimonies",
    "Word Ministration",
    "Offering & Tithes",
    "Announcements",
    "Benediction"
  ],
  foods: [
    "Jollof Rice",
    "Fried Rice",
    "White Rice & Stew",
    "Rice & Beans",
    "Beans",
    "Moi moi",
    "Spag Jollof",
    "Stew Spaghetti",
    "Jollof Spag",
    "Amala & Soup",
    "Eba & Soup",
    "Semovita",
    "Pounded Yam",
    "Fasting (till evening)"
  ]
};

export const DEFAULT_ROSTERS: RostersMap = {
  prayer_roster: {
    id: "prayer_roster",
    title: "Prayer Roster",
    icon: "🕯️",
    image: "/images/prayer_glow.jpg",
    themeClass: "theme-prayer",
    editableBy: "prayer_coordinator",
    columns: [
      { key: "time", label: "Time", editable: true, isTime: true },
      { key: "event", label: "Event / Theme", editable: true, list: "events" },
      { key: "person", label: "Assigned Person", editable: true, list: "members" }
    ],
    rows: [
      { day: "Monday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Chidera" },
      { day: "Monday", time: "08:30 PM – 09:00 PM", event: "Evening Devotional: Hymns", person: "Mimi" },
      { day: "Tuesday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Segun" },
      { day: "Tuesday", time: "06:00 PM – 07:00 PM", event: "Fasting & Prayer Meeting", person: "Ofonime" },
      { day: "Wednesday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Christopher" },
      { day: "Wednesday", time: "08:30 PM – 09:00 PM", event: "Theme Exposition", person: "Olayinka" },
      { day: "Thursday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Prince" },
      { day: "Thursday", time: "04:30 PM – 06:00 PM", event: "Bible Study", person: "Judith" },
      { day: "Friday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Oluchi" },
      { day: "Friday", time: "08:30 PM", event: "Discussion Night", person: "Ola" },
      { day: "Saturday", time: "05:30 AM – 06:00 AM", event: "Morning Prayer", person: "Chidera" },
      { day: "Saturday", time: "08:30 PM – 09:00 PM", event: "Praise & Worship", person: "Mimi" }
    ]
  },
  glorious_service: {
    id: "glorious_service",
    title: "Glorious Service Roster",
    icon: "✨",
    image: "/images/service_glory.jpg",
    themeClass: "theme-service",
    editableBy: "master",
    columns: [
      { key: "time", label: "Time", editable: true, isTime: true },
      { key: "event", label: "Activity / Event", editable: true, list: "events" },
      { key: "person", label: "Assigned Person", editable: true, list: "members" }
    ],
    rows: [
      { day: "Sunday", time: "04:00 PM – 04:10 PM", event: "Opening prayer", person: "Opeyemi" },
      { day: "Sunday", time: "04:10 PM – 04:30 PM", event: "Praise and Worship", person: "Judith" },
      { day: "Sunday", time: "04:30 PM – 04:40 PM", event: "Testimony", person: "Mimi" },
      { day: "Sunday", time: "04:40 PM – 04:50 PM", event: "Worship again", person: "Olayinka" },
      { day: "Sunday", time: "04:50 PM – 05:30 PM", event: "Word Ministration", person: "Chidera" },
      { day: "Sunday", time: "05:30 PM – 05:40 PM", event: "Announcement", person: "Segun" },
      { day: "Sunday", time: "05:40 PM – 05:50 PM", event: "Offering", person: "Mimi" },
      { day: "Sunday", time: "05:50 PM – 06:00 PM", event: "Benediction", person: "General" }
    ]
  },
  cleaning_roster: {
    id: "cleaning_roster",
    title: "Cleaning Roster",
    icon: "🧹",
    image: "/images/clean_vessel.jpg",
    themeClass: "theme-cleaning",
    editableBy: "master",
    columns: [
      { key: "person", label: "Assigned Person", editable: true, list: "members" }
    ],
    rows: [
      { day: "Sunday", person: "Judith" },
      { day: "Monday", person: "Ofonime" },
      { day: "Tuesday", person: "Christopher" },
      { day: "Wednesday", person: "Segun" },
      { day: "Thursday", person: "Opeyemi" },
      { day: "Friday", person: "Prince" },
      { day: "Saturday", person: "Judith" }
    ]
  },
  cooking_roster: {
    id: "cooking_roster",
    title: "Cooking Roster",
    icon: "🍳",
    image: "/images/service_glory.jpg",
    themeClass: "theme-cooking",
    editableBy: "master",
    columns: [
      { key: "person", label: "On Duty", editable: true, list: "members" },
      { key: "breakfast", label: "Breakfast", editable: true, list: "foods" },
      { key: "dinner", label: "Dinner", editable: true, list: "foods" }
    ],
    rows: [
      { day: "Sunday", person: "Judith", breakfast: "Jollof Rice", dinner: "Spag Jollof" },
      { day: "Monday", person: "Opeyemi", breakfast: "Rice & Stew", dinner: "Eba" },
      { day: "Tuesday", person: "Ofonime", breakfast: "Fasting (till evening)", dinner: "Moi moi" },
      { day: "Wednesday", person: "Olayinka", breakfast: "Rice & Beans", dinner: "Amala" },
      { day: "Thursday", person: "Chidera", breakfast: "Rice & Stew", dinner: "Stew Spaghetti" },
      { day: "Friday", person: "Mimi", breakfast: "Jollof Spag", dinner: "Beans" },
      { day: "Saturday", person: "Christopher", breakfast: "Rice & Stew", dinner: "Eba" }
    ]
  }
};
