/**
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name VARCHAR(100) NOT NULL,
type VARCHAR(20) NOT NULL,
rarity VARCHAR(20) NOT NULL,
stats JSONB NOT NULL,
icon_url VARCHAR(255)
 **/

/**
  POST    /addItem
  GET     /getItem
  PUT     /modifyItem
  DELETE  /deleteItem
 **/


