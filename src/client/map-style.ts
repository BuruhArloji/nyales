import type {StyleSpecification} from 'maplibre-gl';

/** OpenMapTiles road refs may lack ref_length. Keep those labels hidden instead
 * of comparing null with a number inside every tile worker. */
export function normalizeBasemapStyle(style:StyleSpecification):StyleSpecification{
 function filter(value:any):any{
  if(!Array.isArray(value))return value;
  if(value[0]==='<='&&Array.isArray(value[1])&&value[1][0]==='get'&&value[1][1]==='ref_length'&&typeof value[2]==='number'){
   return ['<=',['number',['get','ref_length'],value[2]+1],value[2]];
  }
  return value.map(filter);
 }
 return {...style,layers:style.layers.map(layer=>/^(highway-shield-|road_shield_)/.test(layer.id)&&'filter' in layer?
  {...layer,filter:filter(layer.filter)}:layer)};
}
