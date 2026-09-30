// src/services/ExportAdapter.ts

// 1. Target: A interface que o sistema frontend espera consumir
export interface IDataExporter {
  exportDataAsJson(data: any[]): string;
}

// 2. Adaptee: A classe legado/externa que só sabe gerar XML
export class XMLDataGenerator {
  public generateXML(data: any[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?><records>';
    
    data.forEach(item => {
      xml += '<record>';
      for (const key in item) {
        // Ignora valores nulos ou indefinidos na geração do XML
        const value = item[key] !== null && item[key] !== undefined ? item[key] : '';
        xml += `<${key}>${value}</${key}>`;
      }
      xml += '</record>';
    });
    
    xml += '</records>';
    return xml;
  }
}

// 3. Adapter: Classe que adapta a saída de XML para JSON
export class XMLToJsonAdapter implements IDataExporter {
  private xmlGenerator: XMLDataGenerator;

  constructor(xmlGenerator: XMLDataGenerator) {
    this.xmlGenerator = xmlGenerator;
  }

  public exportDataAsJson(data: any[]): string {
    // 1º Passo: Chama o serviço que gera XML
    const xmlString = this.xmlGenerator.generateXML(data);
    
    // 2º Passo: Converte internamente esse XML para JSON e devolve
    return this.convertXmlToJson(xmlString);
  }

  private convertXmlToJson(xmlString: string): string {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const records = xmlDoc.getElementsByTagName("record");
    
    const jsonResult: any[] = [];

    Array.from(records).forEach(recordNode => {
      const obj: any = {};
      Array.from(recordNode.children).forEach(child => {
        const textValue = child.textContent || '';
        const numberValue = Number(textValue);
        
        obj[child.tagName] = isNaN(numberValue) || textValue === '' ? textValue : numberValue;
      });
      jsonResult.push(obj);
    });

    return JSON.stringify(jsonResult, null, 2); 
  }
}