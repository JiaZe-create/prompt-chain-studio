export type Chain={id:string;name:string;description:string;created_at:string;updated_at:string};
export type Step={id:string;chain_id:string;name:string;prompt_template:string;step_order:number;model:string;temperature:number};
export type Run={id:string;chain_id:string;input_text:string;status:string;output_text:string|null;error:string|null;step_outputs:{name:string;output:string;model:string}[];created_at:string};
