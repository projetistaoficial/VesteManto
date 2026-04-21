public class Exercicio10 {
    public static void main(String[] args) {
        boolean temCarros = true;
        boolean temPedestres = true;
        String estadoAtual = "Verde para pedestres";

        if (temCarros) {
            // Mesmo com pedestres aguardando, a prioridade absoluta da regra 1 é o carro.
            System.out.println("Ação: Dar prioridade para carros. (Sinal verde para carros)");
        } else if (!temCarros && temPedestres) {
            System.out.println("Ação: Liberar passagem de pedestres. (Sinal verde para pedestres)");
        } else {
            System.out.println("Nenhum movimento detectado. Mantendo estado atual: " + estadoAtual);
        }
    }
}