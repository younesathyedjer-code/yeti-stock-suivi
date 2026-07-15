import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => {

    return {

        plugins: [
            react(),
            tailwindcss()
        ],


        resolve: {

            alias: {

                "@":
                    path.resolve(
                        __dirname,
                        "."
                    )

            }

        },


        build: {

            rollupOptions: {

                output: {

                    manualChunks(id) {


                        if (
                            id.includes(
                                "node_modules/react"
                            )
                        ) {

                            return "react";

                        }


                        if (
                            id.includes(
                                "node_modules/lucide-react"
                            )
                        ) {

                            return "icons";

                        }


                        if (
                            id.includes(
                                "node_modules/firebase"
                            )
                        ) {

                            return "firebase";

                        }


                        if (
                            id.includes(
                                "node_modules"
                            )
                        ) {

                            return "vendor";

                        }

                    }

                }

            },


            chunkSizeWarningLimit:
                1500

        },


        server: {

            hmr:
                process.env.DISABLE_HMR !== "true",


            watch:
                process.env.DISABLE_HMR === "true"
                    ? null
                    : {}

        }


    };

});