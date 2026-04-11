const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    "postcss-preset-env": {
      features: {
        "cascade-layers": true,
        "color-mix": true,
      },
      browsers: "Safari >= 15, iOS >= 15",
    },
  },
};

export default config;
