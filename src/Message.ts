export type Message =
    (
        | {
            type: 'result';
            result: unknown;
        }
        | {
            type: 'error';
            error: unknown;
        }
        | {
            type: 'run';
            func: string;
            // These params are the arguments to pass to the func.
            // Listed like: 'argument0': any, 'argument1': any, etc.
            [k: string]: any;
        }
    )
    & {
        id: number;
    };
