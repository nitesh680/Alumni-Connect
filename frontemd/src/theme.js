import { extendTheme } from "@chakra-ui/react";

const colors = {
  brand: {
    50: "#ecefff",
    100: "#c5ccff",
    200: "#9eabff",
    300: "#788aff",
    400: "#5169ff",
    500: "#2a48ff",
    600: "#1f38d6",
    700: "#172aa6",
    800: "#101d77",
    900: "#0a134d",
  },
  gray: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },
};

const fonts = {
  heading: "Work Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', Arial, sans-serif",
  body: "Work Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', Arial, sans-serif",
};

const components = {
  Button: {
    baseStyle: {
      borderRadius: "10px",
      fontWeight: 600,
    },
    sizes: {
      lg: { h: 12, fontSize: "lg", px: 6 },
    },
    variants: {
      solid: {
        bg: "brand.500",
        color: "white",
        _hover: { bg: "brand.600" },
        _active: { bg: "brand.700" },
        _disabled: { bg: "gray.300" },
      },
      outline: {
        borderColor: "brand.500",
        color: "brand.600",
        _hover: { bg: "brand.50" },
      },
    },
  },
  Input: {
    variants: {
      filled: {
        field: {
          bg: "gray.50",
          _hover: { bg: "gray.100" },
          _focus: { bg: "white", borderColor: "brand.500", boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)" },
        },
      },
    },
  },
  FormLabel: {
    baseStyle: {
      fontWeight: 600,
      color: "gray.700",
    },
  },
  Badge: {
    baseStyle: {
      borderRadius: "6px",
      textTransform: "none",
      fontWeight: 600,
      px: 2,
    },
    variants: {
      subtle: {
        bg: "brand.50",
        color: "brand.700",
      },
    },
  },
  Heading: {
    baseStyle: {
      color: "gray.800",
      letterSpacing: "-0.02em",
    },
  },
  Text: {
    baseStyle: {
      color: "gray.700",
    },
  },
  Tooltip: {
    baseStyle: {
      borderRadius: "8px",
      bg: "gray.800",
      color: "white",
      px: 3,
      py: 2,
      shadow: "lg",
    },
  },
};

const styles = {
  global: {
    "html, body, #root": {
      height: "100%",
    },
    body: {
      bg: "gray.50",
      color: "gray.800",
    },
    "::selection": {
      background: "brand.200",
      color: "gray.900",
    },
  },
};

const config = {
  initialColorMode: "light",
  useSystemColorMode: false,
};

const theme = extendTheme({ colors, fonts, components, styles, config, shadows: { 
  outline: "0 0 0 3px rgba(42, 72, 255, 0.36)",
}, radii: { md: "10px", lg: "12px" } });

export default theme;
